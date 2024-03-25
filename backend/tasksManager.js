import { EventEmitter } from "events";
import { v4 as uuid } from "uuid";
import { calcRemainingTime } from "./utils.js";
import { diskManager } from "./index.js";
import Badblocks from "./commands/badblocks.js";
import WGet from "./commands/wget.js";
import Command from "./commands.js";

export default class TasksManager extends EventEmitter {
  constructor() {
    super();
    this.ready = [];
    this.running = [];
    this.done = [];
  }

  /**
   * Add listeners to task object.
   * Call this function after creating a new task object.
   *
   * @param {Task} task - Task object to which the listeners should be added
   */
  addTaskListeners(task) {
    task.on("started", () => {
      this.emit("taskStarted", task);
    });

    task.on("progressUpdate", () => {
      this.emit("taskProgressUpdate", task);
    });

    task.on("error", (err) => {
      this.emit("taskError", err, task);
    });

    task.on("done", () => {
      this.taskDone(task);
      this.runNext(task.diskName);
      this.emit("taskCompleted", task);
    });
  }

  /**
   *
   * @param {*} tasks - array of objects with fields:
   *  {
   *    {Disk} disk - Disk on which the task will be executed
   *    {String} program - Name of the program to execute
   *    {Object} options - Options for the execution of the program
   *  }
   *
   * The order of tasks in the array determines the order of execution
   * of the tasks in the task chain.
   */
  newTaskChain(tasks) {
    if (!tasks?.length) return undefined;

    const taskChainId = uuid();
    const tasksList = [];

    tasks.forEach((t, pos) => {
      const taskId = this.startTask(
        t.disk,
        t.program,
        t.options,
        taskChainId,
        pos
      );
      tasksList.push({ uuid: taskId, pos: pos });
    });

    return { taskChainId: taskChainId, tasks: tasksList };
  }

  getTaskChain(taskChainId) {
    const tasks = this.allTasks()
      .filter((t) => t.taskChainId === taskChainId)
      .sort((a, b) => a.taskChainPos - b.taskChainPos);

    return tasks;
  }

  /**
   * Create a new Task and start it if no other task for the same disk
   * is running.
   *
   * @param {Disk} disk - Disk on which the task will be executed
   * @param {String} program - Name of the program to execute
   * @param {Object} options - Options for the execution of the program
   * @param {String} [taskChainId] - Identifier of the task chain to which the task belongs.
   * If not specified, a new task chain with only this task is created.
   * @param {Number} [taskChainPos] - Position of the task in the task chain execution order.
   * If not specified and taskChainId is specified, the position will automatically be assigned to be the last in the task chain.
   * If not specified and also taskChainId is not specified, the position will be the first.
   * If specified and taskChainId is not, then the position passed as a parameter will be ignored and the position will be assigned
   * following the previous two criteria.
   *
   * @returns {Number} uuid of the new task
   */
  startTask(disk, program, options, taskChainId, taskChainPos) {
    if (!taskChainId) {
      taskChainId = uuid();
      taskChainPos = 0;
    }

    if (taskChainPos === undefined) {
      taskChainPos = this.getTaskChain(taskChainId).length;
    }

    const newTask = new Task(disk, program, options, taskChainId, taskChainPos);

    this.addTaskListeners(newTask);

    this.emit("newTask", newTask);

    if (this.running.some((t) => t.diskName === disk.name)) {
      this.ready.push(newTask);
    } else {
      this.running.push(newTask);
      newTask.start();
    }

    return newTask.uuid;
  }

  /**
   * Move a completed task from running to done list.
   *
   * @param {Task} task
   */
  taskDone(task) {
    this.running = this.running.filter((t) => t.uuid !== task.uuid);
    this.done.push(task);
  }

  /**
   * Run next task in queue for a specific disk.
   * If no task is in queue, nothing happens.
   *
   * @param {String} diskName
   */
  runNext(diskName) {
    if (!diskManager.getDisk(diskName)) return;

    const i = this.ready.findIndex((t) => t.diskName === diskName);
    if (i !== -1) {
      const task = this.ready.splice(i, 1);
      this.running.push(task);
      task.start();
    }
  }

  getTask(uuid) {
    [...this.running, ...this.ready, ...this.done].find((t) => t.uuid === uuid);
  }

  get allTasks() {
    const list = [];

    this.running.map((t) => list.push({ ...t, status: "running" }));
    this.ready.map((t) => list.push({ ...t, status: "ready" }));
    this.done.map((t) => list.push({ ...t, status: "done" }));

    return list;
  }

  get taskQueues() {
    return {
      running: this.running,
      ready: this.ready,
      done: this.done,
    };
  }

  get runningTasks() {
    return this.running;
  }

  get readyTasks() {
    return this.ready;
  }

  get doneTasks() {
    return this.done;
  }

  get taskChains() {
    const taskChainsMap = this.allTasks.reduce((map, task) => {
      const taskChainId = task.taskChainId;
      if (!map.has(taskChainId)) {
        map.set(taskChainId, { taskChainId, tasks: [task] });
      } else {
        map.get(taskChainId).tasks.push(task);
      }
      return map;
    }, new Map());

    return Object.values(taskChainsMap);
  }
}
/**
 * Task class
 *
 * @description A task represents an encapsulation for a program execution,
 * managing its start, progress and termination. Each task can be part of a
 * chain of tasks, in which each one has a position that determines the order
 * of execution.
 * @emits "started" : when the actual process starts
 * @emits "progressUpdate" : when a new update of the process progress is available
 * @emits "done" : when the process ends without errors
 * @emits "error" : when there is an error in the process
 */
class Task extends EventEmitter {
  /**
   * Create a new Task.
   *
   * @param {Disk} disk - Disk on which the task will be executed
   * @param {String} program - Name of the program to execute
   * @param {Object} options - Options for the execution of the program
   */
  constructor(disk, program, options, taskChainId, taskChainPos) {
    super();
    this.uuid = uuid();
    this.disk = disk;
    this.program = program;
    this.options = options;
    this.command = undefined;
    this.progress = 0;
    this.completed = false;
    this.eta = undefined;
    this.addedTime = new Date();
    this.startTime = undefined;
    this.endTime = undefined;
    this.lastProgressUpdates = [];
    this.taskChainId = taskChainId;
    this.taskChainPos = taskChainPos;
  }

  /**
   * Add listeners to Command object.
   * Call this function after creating a new command object.
   *
   * @param {Command} command - Command object to which the listeners should be added
   */
  addCommandListeners(command) {
    command.on("update", (percentage) => {
      this.updateProgress(percentage);
    });

    command.on("error", (err) => {
      this.error(err);
    });

    command.on("done", () => {
      this.done();
    });
  }

  /**
   * Starts executing the task program.
   * Emits an "error" event if the program name is not supported.
   */
  start() {
    /**
     * The idea is that I want to have a sort of "Program" entity, which
     * starts a process from a command (e.g. badblocks) and
     * can emit "done", "update", "error" to give updates to the task entity.
     */
    if (this.program === "badblocks") {
      this.command = new Badblocks(this.disk.name);
    } else if (this.program === "wget") {
      this.command = new WGet("https://ash-speed.hetzner.com/100MB.bin");
    } else {
      this.error(`Can't find program ${program}`);
      return;
    }

    this.disk.busy = true;
    this.startTime = Date.now();
    this.emit("started", this);
  }

  /**
   * Mark the Task as completed, free the disk and notify the task manager.
   */
  done() {
    this.endTime = Date.now();
    this.progress = 100;
    this.completed = true;
    this.eta = 0;
    this.disk.busy = false;
    this.emit("done", this);
  }

  /**
   * Updates the progress percentage and the eta value.
   *
   * @param {number} percentage from 0 to 100
   * @param {number} [eta] number in seconds till completion (optional)
   */
  updateProgress(percentage, eta) {
    // TODO: this function takes "eta" as a parameter but then completely ignores it; change it
    if (percentage <= this.progress) {
      // update only the eta value in this case
      this.eta = eta ?? this.eta;
      return;
    }

    if (percentage > 100) percentage = 100; // IDK how you managed that, but GG

    this.progress = percentage;
    this.lastProgressUpdates.push({
      time: Date.now(),
      percentage,
    });

    // limit the number of last progress to 6 to compute the average speed
    const MAX_PROGRESS_UPDATES = 6;
    if (this.lastProgressUpdates.length > MAX_PROGRESS_UPDATES) {
      this.lastProgressUpdates.shift();
    }

    this.eta = calcRemainingTime(this.progress, this.lastProgressUpdates);
    this.emit("progressUpdate", this);
  }

  /**
   * Notify the task manager that an error occurred in the task.
   *
   * @param {*} err
   */
  error(err) {
    console.log(`TaskManager: error! ${err}`);
    this.emit("error", err);
    this.completed = false;
  }

  /**
   * Get JSON object to represent the task.
   *
   * @returns {Object}
   */
  toJSON() {
    return {
      uuid: this.uuid,
      diskName: this.disk.name,
      program: this.program,
      options: this.options,
      completed: this.completed,
      progress: this.progress,
      eta: this.eta,
      startTime: this.startTime,
      endTime: this.endTime,
      addedTime: this.addedTime,
      taskChainId: this.taskChainId,
      taskChainPos: this.taskChainPos,
    };
  }
}
