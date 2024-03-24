import express from "express";
import { tasksManager } from "../index.js";

const tasksRouter = express.Router({ mergeParams: true });

/**
 * Middleware to get specific task info and put it into request object.
 * The request should contain a parameter "uuid", used as identifier
 * of the task.
 * If the "uuid" doesn't represent any task, then 404 is returned.
 */
const embedTaskIntoRequest = (req, res, next) => {
  let task = tasksManager.getTask(req.params.uuid);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  req.task = task;
  next();
};

/**
 * GET /tasks
 *
 * Retrieve the list of all tasks
 */
tasksRouter.get("/", (req, res) => {
  res.json(tasksManager.allTasks);
});

/**
 * GET /tasks/chains/:uuid
 *
 * Retrieve the info for a specific task chain identified by its "uuid".
 */
tasksRouter.get("/chains/:uuid", (req, res) => {
  res.json(tasksManager.getTaskChain(uuid));
});

/**
 * POST /tasks/chains
 *
 * Add a new task chain.
 */
tasksRouter.post("/chains", (req, res) => {
  // TODO: validate array of tasks
  res.json(tasksManager.newTaskChain(req.body.tasks));
});

/**
 * GET /tasks/chains
 *
 * Retrieve all the tasks grouped by their task chain id
 */
tasksRouter.get("/chains", (req, res) => {
  res.json(tasksManager.taskChains);
});

/**
 * Use middleware to embed disk info for every route accessing
 * a specific disk by "name" parameter.
 */
tasksRouter.use("/:uuid", embedTaskIntoRequest);

/**
 * GET /tasks/:uuid
 *
 * Retrieve the info for a specific task identified by "uuid".
 */
tasksRouter.get("/:uuid", (req, res) => {
  res.json(req.task);
});

// TODO add endpoints to stop task

export default tasksRouter;
