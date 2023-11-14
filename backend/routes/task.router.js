import express from "express";
import { tasksManager } from "../index";

const taskRouter = express.Router({ mergeParams: true });

taskRouter.get("/", (req, res) => {
  res.json(tasksManager.listTasks());
});

taskRouter.use((req, res, next) => {
  let task = tasksManager.getTask(req.params.uuid);
  if (task === undefined) return res.status(404).send();
  req.task = task;
  next();
});

// TODO add endpoints to stop task

router.use("/tasks/:uuid", taskRouter); // TODO: is it necessary to use a middleware?

export default taskRouter;
