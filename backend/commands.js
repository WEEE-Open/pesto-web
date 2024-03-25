import { EventEmitter } from "events";

export default class Command extends EventEmitter {
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
