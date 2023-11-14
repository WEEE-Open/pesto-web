import config from './config.js';

import express from 'express';
import yargs from 'yargs';

const argv = yargs(process.argv)
  .option('prod', {
    alias: 'p',
    description: 'Run in production mode',
    type: 'boolean'
  })
  .help()
  .alias('help', 'h').argv;

import api, { init } from './api.js';
import DiskManager from './diskManager.js';
import TasksManager from './tasksManager.js';
import Tarallo from './tarallo.js';
import FileManager from './fileManager.js';

export const diskManager = new DiskManager({
	refreshInterval: config.diskRefeshInterval,
	filter: config.ignore,
});

export const tasksManager = new TasksManager();

export const tarallo = new Tarallo(config.taralloBaseUrl, config.taralloApiKey);

export const fileManager = new FileManager(config.fileRoot);

let app = express();
app.use(express.json());

// this is to fix a deprecated function in the express-sse module, do not removed untill updated
app.use(function (req, res, next) {
	res.flush = function () { /* Do nothing */ }
	next();
});

init();

app.use('/api/v1/', api);

if (argv.prod) {
    app.use('/', express.static('../frontend/dist'));
	app.use((req, res) => {
		res.sendFile('../frontend/dist/index.html');
	});
}
// ! do NOT put anything after this otherwise they will be bypassed in prod
app.listen(config.port, () => {
    console.log(`Server started on port ${config.port}`);
});