import { EventEmitter } from "events";
import { v4 as uuid } from "uuid";
import { spawn } from "child_process";
import { calcRemainingTime } from "./utils.js";
import { diskManager } from "./index.js";

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
   */
  newTaskChain(tasks) {
    if (!tasks?.length) return undefined;

    const taskChainId = uuid();
    const tasks = [];

    tasks.forEach((t, pos) => {
      const taskId = this.startTask(
        t.disk,
        t.program,
        t.options,
        taskChainId,
        pos
      );
      tasks.push({ uuid: taskId, pos: pos });
    });

    return { taskChainId: taskChainId, tasks: tasks };
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
   *
   * @returns {Number} uuid of the new task
   */
  startTask(disk, program, options, taskChainId, taskChainPos) {
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

  get taskLists() {
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
}

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
   * Starts executing the task program.
   * Emits an "error" event if the program name is not supported.
   */
  start() {
    /* // TODO: maybe use a strategy pattern or something like that.
     * the idea is that I want to have a sort of "Program" entity, which
     * starts a process from a command (e.g. badblocks) and
     * can call done(), updateProgress(), error() to update the task status.
     */
    if (program === "badblocks") {
      this.badblocks(this.options);
    } else {
      error(`Can't find program ${program}`);
      return;
    }

    this.disk.busy = true;
    this.startTime = Date.now();
    this.emit("started", this);
  }

  /**
   * Mark the Task as completed, free the disk and notify the task managar.
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

  // All the actual programs

  badblocks(opt) {
    let checking = false;

    const badblocks = spawn("badblocks", [
      "-w",
      "-s",
      "-p",
      "0",
      "-t",
      "0x00",
      "-b",
      "4096",
      this.disk.name,
    ]);

    badblocks.stdout.on("data", (data) => {
      if (!checking && data.includes("Reading and comparing")) checking = true;
      let match = data.match(/(\d+)%/);
      if (match.length !== 0) {
        this.updateProgress(Number(match[1]) / 2 + 50 * checking);
      }
    });

    badblocks.stderr.on("data", (data) => {
      data = String(data);
      if (!checking && data.includes("Reading and comparing")) checking = true;
      let match = data.match(/(\d+)%/);
      if (match.length !== 0) {
        this.updateProgress(Number(match[1]) / 2 + 50 * checking);
      }
    });

    /*badblocks.stderr.on('data', (data) => {
			this.error(`Badblocks error: ${data}`);
			//badblocks.kill();
		});*/

    badblocks.on("close", (code) => {
      if (code !== 0) {
        this.error(`Badblocks exited with code ${code}`);
      } else {
        this.done();
      }
    });
  }
}
