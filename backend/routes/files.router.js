import express from "express";
import { fileManager } from "../index.js";

const filesRouter = express.Router({ mergeParams: true });

const embedFilePathIntoRequest = (req, res, next) => {
  if (fileManager.isPathSafe(req.params.path) === false)
    return res.status(403).send();

  if (req.params.path === "") {
    req.params.path = "/";
  }

  req.filePath = fileManager.safeJoin(fileManager.root, req.params.path);

  next();
};

filesRouter.use("", embedFilePathIntoRequest);

filesRouter.get("", async (req, res) => {
  fileManager
    .getPathStats(fileManager.safeJoin(fileManager.root, req.filePath)) //? isn't the filePath already joined with root?
    .then((r) => res.json(r))
    .catch((e) => res.status(404).json({ error: "File not found" }));
});

filesRouter.post("", async (req, res) => {
  fileManager
    .saveFile(
      fileManager.safeJoin(fileManager.root, req.params.path),
      req.body.data
    )
    .then((r) => res.json(r))
    .catch((e) => res.status(404).json({ error: "File not found" })); //? is this the right error? maybe also add a better message
});

export default filesRouter;
