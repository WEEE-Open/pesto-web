import express from "express";
import { fileManager } from "../index.js";

const filesRouter = express.Router({ mergeParams: true });

const embedFilePathIntoRequest = (req, res, next) => {
  try {
    // if safe join fails the path is outside the root dir
    req.filePath = fileManager.safeJoin(fileManager.root, req.params.path || "/");
    next();
  } catch (error) {
    return res.status(403).send({ error: error.message });
  }
};

filesRouter.use("/:path(*)", embedFilePathIntoRequest);

filesRouter.get("/:path(*)", async (req, res) => {
  fileManager
    .getPathStats(req.filePath)
    .then((r) => res.json(r))
    .catch((e) => res.status(404).json({ error: "File not found" }));
});

filesRouter.post("/:path(*)", async (req, res) => {
  fileManager
    .saveFile(
      req.filePath,
      req.body.data
    )
    .then(() => res.json({ message: "File written successfully" }))
    .catch((err) => res.status(404).json({ error: err.message }));
});

export default filesRouter;
