import express from "express";
import { diskManager } from "../index.js";

const disksRouter = express.Router({ mergeParams: true });

/**
 * GET /disks
 *
 * Retrieve the list of all disks
 */
disksRouter.get("/", (req, res) => {
  res.json(diskManager.listDisks());
});

/**
 * GET /disks/refresh
 *
 * Refresh the list of all disks
 */
//? does this do a diff or something like that?
disksRouter.get("/refresh", async (req, res) => {
  res.json(await diskManager.refreshDisksList());
});

/**
 * Middleware to get specific disk info and put it into request object.
 * The request should contain a parameter "name", used as identifier
 * of the disk. This name should actually be only the part after /dev/,
 * e.g. to do operations on /dev/sda you should call /disks/sda(/...)
 *
 * If the "name" doesn't represent any disk, then 404 is returned.
 */
const embedDiskIntoRequest = (req, res, next) => {
  const disk = diskManager.getDisk("/dev/" + req.params.name);
  if (!disk) {
    return res.status(404).json({ error: "Disk not found" });
  }
  req.disk = disk;
  next();
};

/**
 * Use middleware to embed disk info for every route accessing
 * a specific disk by "name" parameter.
 */
disksRouter.use("/:name", embedDiskIntoRequest);

/**
 * GET /disks/:name
 *
 * Retrieve the info for a specific disk identified by "name".
 */
disksRouter.get("/:name", (req, res) => {
  res.json(req.disk);
});

/**
 * GET /disks/:name/refreshSmartData
 *
 * Refresh smart data for a specific disk identified by "name".
 */
disksRouter.get("/:name/refreshSmartData", (req, res) => {
  req.disk
    .recoverSmartData()
    .then((smartData) => {
      res.json(smartData);
    })
    .catch((code) => {
      res.status(500).json({ code });
    });
});

/**
 * GET /disks/:name/tarallo
 *
 * Gets info from Tarallo inventory system
 * for a specific disk identified by "name".
 */
disksRouter.get("/:name/tarallo", (req, res) => {
  req.disk
    .findOnTarallo()
    .then((taralloProperties) => {
      res.json(taralloProperties);
    })
    .catch((e) => {
      res.status(404).send({ error: "Disk not found on Tarallo" });
    });
});

/**
 * POST /disks/:name/tarallo
 *
 * Uploads info to Tarallo inventory system
 * for a specific disk identified by "name".
 */
disksRouter.post("/:name/tarallo", (req, res) => {
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

  req.disk
    .uploadOnTarallo("box16")
    .then((code) => {
      res.send(code);
    })
    .catch((e) => {
      res.status(500).send({ error: "Error while uploading on Tarallo" });
    });
});

/**
 * GET /disks/:name/executeProcess/:process
 *
 * Executes an operation on a specific disk identified by "name".
 */
disksRouter.get("/:name/executeProcess/:process", (req, res) => {
  let taskId;

  switch (req.params.process) {
    case "format":
      taskId = req.disk.format();
      break;
    default:
      res.status(404).send({ error: "Process not found" });
      return;
  }

  res.status(201).send({ uuid: taskId });
});

export default disksRouter;
