import Command from "../commands.js";
import { spawn } from "child_process";
import { parsePercentage } from "../utils.js";

export default class Badblocks extends Command {
  constructor(diskName) {
    super();
    this.diskName = diskName;
  }

  run() {
    this.process = spawn("badblocks", [
      "-w",
      "-s",
      "-p",
      "0",
      "-t",
      "0x00",
      "-b",
      "4096",
      this.diskName,
    ]);

    this.process.stderr.on("data", (data) => {
      const percentage = parsePercentage(data.toString());
      if (percentage !== null) {
        this.emit("update", percentage);
      }
    });

    this.process.on("close", (code) => {
      if (code === 0) {
        this.emit("done");
      } else {
        this.emit("error", new Error(`Badblocks exited with code ${code}`));
      }
    });

    // check for failed spawn
    this.process.on("error", (err) => {
      this.emit("error", new Error(`Failed to run badblocks. Error: ${err}`));
    });
  }
}
