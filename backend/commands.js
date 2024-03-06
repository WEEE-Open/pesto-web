import { EventEmitter } from "events";
import { spawn } from "child_process";

class Command extends EventEmitter {
  constructor() {
    super();
    this.process = undefined;
  }

  // abstract method
  run() {
    throw new Error(
      "Run is an abstract method and must be implemented by subclasses"
    );
  }

  stop() {
    this.process?.kill("SIGTERM");
  }
}

class Badblocks extends Command {
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

function parsePercentage(data) {
  const match = data.match(/(\d+)%/);
  return match ? parseInt(match[1]) : null;
}

class WGet extends Command {
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