import { EventEmitter } from "events";
import { v4 as uuid } from "uuid";
import { spawn } from "child_process";
import { calcRemainingTime } from "./utils.js";

export default class TasksManager extends EventEmitter {
  constructor() {
    super();
    this.tasks = [];
  }

  startTask(name, disk, steps) {
    const newTask = new Task(name, disk, steps);

    newTask.on("progressUpdate", () => {
      this.emit("taskProgressUpdate", newTask);
    });

    newTask.on("error", (err) => {
      this.emit("taskError", err, newTask);
    });

    newTask.on("nextStep", () => {
      this.emit("taskNextStep", newTask);
    });

    newTask.on("done", () => {
      this.emit("taskCompleted", newTask);
    });

    this.emit("newTask", newTask);
    this.emit("taskListUpdated", this.listTasks());

    this.tasks.push(newTask);

    return newTask.uuid;
  }

  clearTasks() {
    this.tasks = this.tasks.filter((t) => {
      if (t.completed) {
        t.removeAllListeners();
        return false;
      }
      return true;
    });

    this.emit("taskListUpdated", this.listTasks());
  }

  getTaskIndex(task) {
    if (!(task instanceof Task)) {
      console.error("ERROR: trying to get task index of a non Task object");
      return -1;
    }

    return this.tasks.findIndex((t) => t.uuid === task.uuid);
  }

  getTask(task) {
    let index = this.getTaskIndex(task);
    return index >= 0 ? this.tasks[index] : undefined;
  }

  listTasks() {
    return this.tasks;
  }
}

class Task extends EventEmitter {
  constructor(name, disk, steps) {
    super();
    this.name = name;
    this.disk = disk;
    this.uuid = uuid();
    this.steps = steps; // list of steps (or sub-tasks) of this task
    this.progress = 0;
    this.currentStep = -1;
    this.completed = false;
    this.eta = undefined;
    this.startTime = Date.now();
    this.lastProgressUpdates = [];

    this.disk.busy = true;
    this.done();
  }

  get totalSteps() {
    return this.steps.length;
  }

  /**
   *
   * @param {number} percentage from 0 to 100
   * @param {number} [eta] number in seconds till completion (optional)
   */
  updateProgress(percentage, eta) {
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

  error(err) {
    console.log(`TaskManager: error! ${err}`);
    this.emit("error", err);
    this.completed = false;
  }

  done() {
    this.currentStep++;
    if (this.currentStep === this.steps.length) {
      this.disk.busy = false;
      this.emit("done", this);
      return;
    }
    this.progress = 0;
    this.lastProgressUpdates = [];
    this.emit("nextStep", this);
    switch (this.steps[this.currentStep].program) {
      case "badblocks":
        this.badblocks(this.steps[this.currentStep].options);
        break;
      default:
        error(`Can't find program ${this.steps[this.currentStep].program}`);
    }
  }

  toJSON() {
    return {
      name: this.name,
      progress: this.progress,
      step: this.currentStep,
      totalSteps: this.totalSteps,
      completed: this.completed,
      eta: this.eta,
      startTime: this.startTime,
    };
  }

  // All the actual programs

  badblocks(opt) {
    let checking = false;

    console.log(this);

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
