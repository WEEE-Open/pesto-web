import express from "express";
import { diskManager } from "../index";

const diskRouter = express.Router({ mergeParams: true });

router.get("/disks", (req, res) => {
  res.json(diskManager.listDisks());
});

/** 
 * Middleware to get specific disk info and put it into request object
 */
diskRouter.use((req, res, next) => {
  let disk = diskManager.getDisk(req.params.name);
  if (disk === undefined) {
    return res.status(404).send();
  }
  req.disk = disk;
  next();
});

diskRouter.get("/", (req, res) => {
  res.json(req.disk);
});

diskRouter.get("/refreshSmartData", (req, res) => {
  req.disk
    .recoverSmartData()
    .then((smartData) => {
      res.json(smartData);
    })
    .catch((code) => {
      res.status(500).json({ code });
    });
});

diskRouter.get("/tarallo", (req, res) => {
  req.disk
    .findOnTarallo()
    .then((taralloProperties) => {
      res.json(taralloProperties);
    })
    .catch((code) => {
      res.status(404).send();
    });
});

diskRouter.post("/tarallo", (req, res) => {
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
    .catch((code) => {
      res.status(500).send();
    });
});

diskRouter.get("/executeProcess/:process", (req, res) => {
  switch (req.params.process) {
    case "format":
      req.disk.format();
      break;
    default:
      res.status(404).send();
      return;
  }
  res.status(201).send();
});

diskRouter.get("/disks/refresh", async (req, res) => {
  res.json(await diskManager.refreshDisksList());
});

diskRouter.use("/disks/:name", diskRouter); // TODO: change this maybe?

export default diskRouter;
