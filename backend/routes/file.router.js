import express from "express";
import { fileManager } from "../index";

const fileRouter = express.Router({ mergeParams: true });

fileRouter.use((req, res, next) => {
  if (fileManager.isPathSafe(req.params.path) === false)
    return res.status(403).send();

  if (req.params.path === "") req.params.path = "/";
  req.filePath = fileManager.safeJoin(fileManager.root, req.params.path);

  next();
});

fileRouter.get("", async (req, res) => {
  fileManager
    .getPathStats(fileManager.safeJoin(fileManager.root, req.filePath))
    .then((r) => res.json(r))
    .catch((e) => res.status(404).send());
});

fileRouter.post("", async (req, res) => {
  if (req.params.path === "") req.params.path = "/";

  fileManager
    .saveFile(
      fileManager.safeJoin(fileManager.root, req.params.path),
      req.body.data
    )
    .then((r) => res.json(r))
    .catch((e) => res.status(404).send());
});

export default fileRouter;
