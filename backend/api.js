import config from './config.js';

import { diskManager, tasksManager, fileManager, tarallo } from './index.js';

import express from 'express';
import SSE from "express-sse";

let router = express.Router();
router.use(express.json());

let sse = new SSE({disks: [], tasks: [], tarallo: {available: false}});

router.get('/stream', sse.init);

export function init() { // TODO: actually a decent method that build the complete object and compares changes, this is very hacky
	function sendUpdatedDiskList() {
		let disksList = diskManager.listDisks();
		sse.initial[0].disks = disksList;
		sse.send([{op:"replace", path:"/disks", value:disksList}]);
	}
	diskManager.on('disksListUpdated', sendUpdatedDiskList);
	diskManager.on('smartData', sendUpdatedDiskList);

	function sendUpdatedTasksList() {
		let tasksList = tasksManager.listTasks();
		sse.initial[0].tasks = tasksList;
		sse.send([{op:"replace", path:"/tasks", value:tasksList}]);
	}
	tasksManager.on('taskListUpdated', sendUpdatedTasksList);
	tasksManager.on('taskCompleted', sendUpdatedTasksList);

	tasksManager.on('taskProgressUpdate', (task) => {
		let index = tasksManager.getTaskIndex(task);
		sse.initial[0].tasks[index].progress = task.progress;
		sse.initial[0].tasks[index].eta = task.eta;
		sse.send([{op:"replace", path:`/tasks/${index}/progress`, value: task.progress}, {op:"replace", path:`/tasks/${index}/eta`, value: task.eta}]);
	});
	tasksManager.on('taskNextStep', (task) => {
		let index = tasksManager.getTaskIndex(task);
		sse.initial[0].tasks[index].progress = task.progress;
		sse.initial[0].tasks[index].eta = task.eta;
		sse.initial[0].tasks[index].step = task.step;
		sse.send([{op:"replace", path:`/tasks/${index}/progress`, value: task.progress}, {op:"replace", path:`/tasks/${index}/eta`, value: task.eta}, {op:"replace", path:`/tasks/${index}/step`, value: task.step}]);
	});
	tasksManager.on('taskCompleted', (task) => {
		let index = tasksManager.getTaskIndex(task);
		sse.initial[0].tasks[index].progress = task.progress;
		sse.initial[0].tasks[index].eta = task.eta;
		sse.initial[0].tasks[index].step = task.step;
		sse.initial[0].tasks[index].completed = task.completed;
		sse.send([{op:"replace", path:`/tasks/${index}/progress`, value: task.progress}, {op:"replace", path:`/tasks/${index}/eta`, value: task.eta}, {op:"replace", path:`/tasks/${index}/step`, value: task.step}, {op:"replace", path:`/tasks/${index}/completed`, value: task.completed}]);
	});

	tarallo.on('available', () => {
		sse.initial[0].tarallo = {available: true};
		sse.send([{op:"replace", path:"/tarallo/available", value: true}]);
	});

	tarallo.on('unavailable', () => {
		sse.initial[0].tarallo = {available: false};
		sse.send([{op:"replace", path:"/tarallo/available", value: false}]);
	});
}

router.get('/ping', (req, res) => {
    res.send('pong');
});

router.get('/tarallo/features.json', (req, res) => {
	if (tarallo.available === false) return res.status(503).send();
	if (tarallo.features == undefined || Object.keys(tarallo.features).length === 0) return res.status(404).send();
	res.json(tarallo.features);
});

router.get('/disks', (req, res) => {
	res.json(diskManager.listDisks());
});router.get('/disks', (req, res) => {
	res.json(diskManager.listDisks());
});

router.get('/disks/refresh', async (req, res) => {
	res.json(await diskManager.refreshDisksList());
});

let diskRouter = express.Router({mergeParams: true});

diskRouter.use((req, res, next) => {
	let disk = diskManager.getDisk(req.params.name);
	if (disk === undefined)
		return res.status(404).send();
	req.disk = disk;
	next();
});

diskRouter.get('/', (req, res) => {
	res.json(req.disk);
});

diskRouter.get('/refreshSmartData', (req, res) => {
	req.disk.recoverSmartData().then((smartData) => {
		res.json(smartData);
	}).catch((code) => {
		res.status(500).json({code});
	});
});

diskRouter.get('/tarallo', (req, res) => {
	req.disk.findOnTarallo().then((taralloProperties) => {
		res.json(taralloProperties);
	}).catch((code) => {
		res.status(404).send();
	});
});

diskRouter.post('/tarallo', (req, res) => {
	//console.log(req.body);
	//if (req.body.body === undefined) return res.status(400).send();

	/*if (body.)

	if (req.body.code === undefined) {
		//
	} else {
		let code = req.body.code;
		delete req.body.code;

		req.disk.taralloProperties = body;
	}*/

	req.disk.uploadOnTarallo("box16").then((code) => {
		res.send(code);
	}).catch((code) => {
		res.status(500).send();
	});
});

diskRouter.get('/executeProcess/:process', (req, res) => {
	switch (req.params.process) {
		case 'format':
			req.disk.format()
			break;
		default:
			res.status(404).send();
			return;
	}
	res.status(201).send();
});

router.use('/disks/:name', diskRouter);


router.get('/tasks', (req, res) => {
	res.json(tasksManager.listTasks());
});

let tasksRouter = express.Router({mergeParams: true});

tasksRouter.use((req, res, next) => {
	let task = tasksManager.getTask(req.params.uuid);
	if (task === undefined)
		return res.status(404).send();
	req.task = task;
	next();
});

// TODO add endpoints to stop task

router.use('/tasks/:uuid', tasksRouter);

let fileRouter = express.Router({mergeParams: true});

fileRouter.use((req, res, next) => {
	if (fileManager.isPathSafe(req.params.path) === false)
		return res.status(403).send();

	if (req.params.path === '') req.params.path = '/';
	req.filePath = fileManager.safeJoin(fileManager.root, req.params.path);

	next();
});

fileRouter.get('', async (req, res) => {
	fileManager.getPathStats(fileManager.safeJoin(fileManager.root, req.filePath))
		.then(r => res.json(r))
		.catch(e => res.status(404).send());
});

fileRouter.post('', async (req, res) => {
	if (req.params.path === '') req.params.path = '/';
	
	fileManager.saveFile(fileManager.safeJoin(fileManager.root, req.params.path), req.body.data)
		.then(r => res.json(r))
		.catch(e => res.status(404).send());
});

router.use('/files:path(*)', fileRouter);

export default router;