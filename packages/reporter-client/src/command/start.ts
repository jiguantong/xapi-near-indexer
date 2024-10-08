import { Service } from "typedi";
import { setTimeout } from "timers/promises";
import { GraphqlService } from "../services/graphql";

export interface StartOptions {}

@Service()
export class XAPIExporterStarter {
  constructor(private graphqlService: GraphqlService) {}

  async start(options: StartOptions) {
    while (true) {
      try {
        await this.run(options);
        await setTimeout(1000);
      } catch (e: any) {
        console.error(e);
      }
    }
  }

  private async run(options: StartOptions) {
    const rms = await this.graphqlService.queryRequestMade();
    console.log(rms, new Date());
  }
}
