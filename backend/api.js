import express from "express";
import { tarallo } from "./index.js";
import sseRouter from "./routes/sse.router.js";
import disksRouter from "./routes/disks.router.js";
import tasksRouter from "./routes/tasks.router.js";
import filesRouter from "./routes/files.router.js";

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
router.use("/disks", disksRouter);

/**
 * Task routes
 */
router.use("/tasks", tasksRouter);

/**
 * File routes
 */
router.use("/files", filesRouter);

/**
 * Tarallo get features json
 */
router.get("/tarallo/features.json", (req, res) => {
  if (!tarallo.available) {
    return res.status(503).send({ error: "Tarallo not available" });
  }

  if (!tarallo.features || Object.keys(tarallo.features).length === 0) {
    return res.status(404).send({ error: "Features not found or empty" });
  }

  res.json({ features: tarallo.features });
});

export default router;
