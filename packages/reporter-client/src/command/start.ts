import { Service } from "typedi";
import { setTimeout } from "timers/promises";
import { GraphqlQuery, GraphqlService } from "../services/graphql";

import { logger, XAPIConfig } from "@ringdao/xapi-common";
import { HelixChainConf } from "@helixbridge/helixconf";


export interface BaseStartOptions {}

export interface StartOptions extends BaseStartOptions {
  targetChains: HelixChainConf[];
}

export interface ReporterLifecycle extends StartOptions {
  targetChain: HelixChainConf;
}

@Service()
export class XAPIExporterStarter {
  constructor(private graphqlService: GraphqlService) {}

  async start(options: StartOptions) {
    // const ge = config.get("graphql.endpoint");
    // console.log(config);
    while (true) {
      for (const chain of options.targetChains) {
        try {
          await this.run({
            ...options,
            targetChain: chain,
          });
        } catch (e: any) {
          console.error(e);
        }
      }
      await setTimeout(1000);
    }
  }

  private async run(lifecycle: ReporterLifecycle) {
    const {targetChain} = lifecycle;
    const query: GraphqlQuery = {
      endpoint: XAPIConfig.graphql.endpoint(targetChain.code),
    };
    console.log(query);
    const rms = await this.graphqlService.queryRequestMade(query);
    logger.debug(lifecycle.targetChain.code, {
      target: "reporter",
      breads: ["hello", "x"],
    });
  }
}
