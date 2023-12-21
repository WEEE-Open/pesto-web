import config from './config.js';

import express from 'express';
import yargs from 'yargs';
import morgan from "morgan";

/* check if backend is executed with root permissions or not */
if (process.env.SUDO_UID === undefined) {
  console.error("******************************");
  console.error("RUN WITH ROOT PRIVILEGES");
  console.error("Please run the backend server with root permissions to correctly run smartctl commands");
  console.error("******************************");
  process.exit(1);
}

const argv = yargs(process.argv)
  .option('prod', {
    alias: 'p',
    description: 'Run in production mode',
    type: 'boolean'
  })
  .help()
  .alias('help', 'h').argv;

import api from './api.js';
import { initSSE } from './sse.js';
import DiskManager from './diskManager.js';
import TasksManager from './tasksManager.js';
import Tarallo from './tarallo.js';
import FileManager from './fileManager.js';

export const diskManager = new DiskManager({
	refreshInterval: config.diskRefeshInterval ?? 10000,
	filter: config.ignore,
});

export const tasksManager = new TasksManager();

export const tarallo = new Tarallo(config.taralloBaseUrl, config.taralloApiKey);

export const fileManager = new FileManager(config.fileRoot);

let app = express();
app.use(express.json());
app.use(morgan("dev"));

// this is to fix a deprecated function in the express-sse module, do not removed untill updated
app.use(function (req, res, next) {
	res.flush = function () { /* Do nothing */ }
	next();
});

initSSE();

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