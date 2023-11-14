import config from "./config.js";

import express from "express";
import { tarallo } from "./index.js";
import sseRouter from "./routes/sse.router.js";
import diskRouter from "./routes/disk.router.js";
import taskRouter from "./routes/task.router.js";
import fileRouter from "./routes/file.router.js";

let router = express.Router();
router.use(express.json());

/**
 * Check if server is alive
 */
router.get("/ping", (req, res) => {
  res.send("pong");
});

/**
 * SSE routes
 */
router.use("/", sseRouter);

/**
 * Disk routes
 */
router.use("/", diskRouter);

/**
 * Task routes
 */
router.use("/tasks", taskRouter);

/**
 * File routes
 */
router.use("/files:path(*)", fileRouter);

/**
 * Tarallo get features json
 */
router.get("/tarallo/features.json", (req, res) => {
  if (tarallo.available === false) {
    return res.status(503).send();
  }

  if (
    tarallo.features == undefined ||
    Object.keys(tarallo.features).length === 0
  ) {
    return res.status(404).send();
  }
  res.json(tarallo.features);
});

export default router;
