import Command from "../commands.js";
import { spawn } from "child_process";
import { parsePercentage } from "../utils.js";

export default class WGet extends Command {
  constructor(url) {
    super();
    this.url = url;
    this.percentage = 0;
  }

  run() {
    this.process = spawn("wget", [this.url]);

    this.process.stderr.on("data", (data) => {
      const percentage = parsePercentage(data.toString());
      if (percentage !== null && percentage !== this.percentage) {
        this.percentage = percentage;
        this.emit("update", percentage);
      }
    });

    this.process.on("close", (code) => {
      if (code === 0) {
        this.emit("done");
      } else {
        this.emit("error", new Error(`Wget exited with code ${code}`));
      }
    });

    // check for failed spawn
    this.process.on("error", (err) => {
      this.emit("error", new Error(`Failed to run wget. Error: ${err}`));
    });
  }
}

function test() {
  const wget = new WGet("https://ash-speed.hetzner.com/100MB.bin");

  wget.on("update", (pct) => console.log(`update percentage: ${pct}%`));
  wget.on("done", () => console.log(`finished`));
  wget.on("error", (err) => console.log(err));

  wget.run();
}

test();
