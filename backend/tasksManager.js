import { EventEmitter } from "events";
import { v5 as uuid } from "uuid";
import { spawn } from 'child_process';


export default class TasksManager extends EventEmitter {
	constructor() {
		super();
		this.tasks = [];
	}

	startTask(name, disk, steps) {
		let newTask = new Task(name, disk, steps);
		newTask.on('progressUpdate', () => {
			this.emit('taskProgressUpdate', newTask);
		});
		newTask.on('error', (err) => {
			this.emit('taskError', err, newTask);
		});
		newTask.on('nextStep', () => {
			this.emit('taskNextStep', newTask);
		});
		newTask.on('done', () => {
			this.emit('taskCompleted', newTask);
		});
		this.emit('newTask', newTask);
		this.emit('taskListUpdated', this.listTasks());
		return this.tasks.push(newTask);
	}

	clearTasks() {
		this.tasks = this.tasks.filter(t => {
			if (t.completed) {
				t.removeAllListeners();
				return false;
			}
			return true;
		});
		this.emit('taskListUpdated', this.listTasks());
	}

	getTaskIndex(task) {
		if (task instanceof Task) {
			task = task.uuid;
		}
		return this.tasks.findIndex(t => t.uuid == task);
	}

	getTask(task) {
		let index = this.getTaskIndex(task);
		if (index === -1) return;
		return this.tasks[index];
	}

	listTasks() {
		return this.tasks;
	}
}

class Task extends EventEmitter {
	constructor(name, disk, list) {
		super();
		this.name = name;
		this.disk = disk;
		this.uuid = "woop";//uuid();
		this.list = list;
		this.progress = 0;
		this.step = -1;
		this.completed = false;
		this.eta = undefined;
		this.startTime = Date.now();
		this.lastProgressUpdates = [];

		this.disk.busy = true;
		this.done();
	}

	get totalSteps() {
		return this.list.length;
	}

	/**
	 * 
	 * @param {number} percentage from 0 to 100 
	 * @param {number} [eta] number in seconds till completion (optional)
	 */
	updateProgress(percentage, eta) {
		if (percentage <= this.progress) {
			if (eta !== undefined)
				this.eta = eta;
			return;
		}
		if (percentage > 100) percentage = 100; // IDK how you managed that, but GG
		this.progress = percentage;
		this.lastProgressUpdates.push({
			time: Date.now(),
			percentage
		});
		if (this.lastProgressUpdates.length > 6) {
			this.lastProgressUpdates.shift();
		}
		let sum = 0;
		for (let i = 0; i < this.lastProgressUpdates.length - 1; i++) {
			let timeDiff = this.lastProgressUpdates[i + 1].time - this.lastProgressUpdates[i].time;
			let progressDiff = this.lastProgressUpdates[i + 1].percentage - this.lastProgressUpdates[i].percentage;
			let speed = progressDiff / timeDiff;
			sum += speed;
		}
		let averageSpeed = sum / (this.lastProgressUpdates.length - 1);
		let remainingProgress = 100 - this.progress;
		let remainingTime = remainingProgress / averageSpeed;
		this.eta = remainingTime;
		this.emit('progressUpdate', this);
	}

	error(err) {
		console.log(`TaskManager: error! ${err}`);
		this.emit('error', err);
		this.completed = false;
	}

	done() {
		this.step++;
		if (this.step === this.list.length) {
			this.disk.busy = false;
			this.emit('done', this);
			return;
		}
		this.progress = 0;
		this.lastProgressUpdates = [];
		this.emit('nextStep', this);
		switch (this.list[this.step].program) {
			case 'badblocks':
				this.badblocks(this.list[this.step].options);
				break;
			default:
				error(`Can't find program ${this.list[this.step].program}`);
		}
	}

	toJSON() {
		return {
			name: this.name,
			progress: this.progress,
			step: this.step,
			totalSteps: this.totalSteps,
			completed: this.completed,
			eta: this.eta,
			startTime: this.startTime
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

		badblocks.stdout.on('data', (data) => {
			if (!checking && data.includes("Reading and comparing")) checking = true;
			let match = data.match(/(\d+)%/);
			if (match.length !== 0) {
				this.updateProgress(Number(match[1])/2+(50*checking));
			}
		});

		badblocks.stderr.on('data', (data) => {
			data = String(data);
			if (!checking && data.includes("Reading and comparing")) checking = true;
			let match = data.match(/(\d+)%/);
			if (match.length !== 0) {
				this.updateProgress(Number(match[1])/2+(50*checking));
			}
		});

	
		/*badblocks.stderr.on('data', (data) => {
			this.error(`Badblocks error: ${data}`);
			//badblocks.kill();
		});*/
	
		badblocks.on('close', (code) => {
			if (code !== 0) {
				this.error(`Badblocks exited with code ${code}`);
			} else {
				this.done();
			}
		});
	}
}