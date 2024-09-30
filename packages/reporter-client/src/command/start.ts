import {setTimeout} from "timers/promises";

export interface StartOptions {

}

export class XAPIExporterStarter {

  async start(options: StartOptions) {
    while (true) {
      console.log(new Date());
      await setTimeout(1000);
    }
  }

}
