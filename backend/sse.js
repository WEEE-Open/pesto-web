import SSE from "express-sse";
import { diskManager, tasksManager, tarallo } from "./index.js";

const sse = new SSE({ disks: [], tasks: [], tarallo: { available: false } });

/**
 * Initialize sse object: setup listeners on disk manager, task manager and other emitters
 * to send objects on those events.
 * Call this function before running the server.
 */
function initSSE() {
  // TODO: actually a decent method that build the complete object and compares changes, this is very hacky
  function sendUpdatedDiskList() {
    let disksList = diskManager.listDisks();
    sse.initial[0].disks = disksList;
    sse.send([{ op: "replace", path: "/disks", value: disksList }]);
  }

  diskManager.on("disksListUpdated", sendUpdatedDiskList);

  diskManager.on("smartData", sendUpdatedDiskList);

  function sendUpdatedTasksList() {
    let tasksList = tasksManager.allTasks;
    sse.initial[0].tasks = tasksList;
    sse.send([{ op: "replace", path: "/tasks", value: tasksList }]);
  }

  tasksManager.on("taskListUpdated", sendUpdatedTasksList);

  tasksManager.on("taskCompleted", sendUpdatedTasksList);

  tasksManager.on("taskProgressUpdate", (task) => {
    let index = tasksManager.getTaskIndex(task);
    sse.initial[0].tasks[index].progress = task.progress;
    sse.initial[0].tasks[index].eta = task.eta;
    sse.send([
      { op: "replace", path: `/tasks/${index}/progress`, value: task.progress },
      { op: "replace", path: `/tasks/${index}/eta`, value: task.eta },
    ]);
  });

  tasksManager.on("taskNextStep", (task) => {
    let index = tasksManager.getTaskIndex(task);
    sse.initial[0].tasks[index].progress = task.progress;
    sse.initial[0].tasks[index].eta = task.eta;
    sse.initial[0].tasks[index].step = task.step;
    sse.send([
      { op: "replace", path: `/tasks/${index}/progress`, value: task.progress },
      { op: "replace", path: `/tasks/${index}/eta`, value: task.eta },
      { op: "replace", path: `/tasks/${index}/step`, value: task.step },
    ]);
  });

  tasksManager.on("taskCompleted", (task) => {
    let index = tasksManager.getTaskIndex(task);
    sse.initial[0].tasks[index].progress = task.progress;
    sse.initial[0].tasks[index].eta = task.eta;
    sse.initial[0].tasks[index].step = task.step;
    sse.initial[0].tasks[index].completed = task.completed;
    sse.send([
      { op: "replace", path: `/tasks/${index}/progress`, value: task.progress },
      { op: "replace", path: `/tasks/${index}/eta`, value: task.eta },
      { op: "replace", path: `/tasks/${index}/step`, value: task.step },
      {
        op: "replace",
        path: `/tasks/${index}/completed`,
        value: task.completed,
      },
    ]);
  });

  tarallo.on("available", () => {
    sse.initial[0].tarallo = { available: true };
    sse.send([{ op: "replace", path: "/tarallo/available", value: true }]);
  });

  tarallo.on("unavailable", () => {
    sse.initial[0].tarallo = { available: false };
    sse.send([{ op: "replace", path: "/tarallo/available", value: false }]);
  });
}

export { sse, initSSE };
