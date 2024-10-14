import { Service } from "typedi";
import { setTimeout } from "timers/promises";
import {
  BasicGraphqlParams,
  EvmGraphqlService,
  NearGraphqlService,
} from "../services/graphql";

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
  constructor(
    private evmGraphqlService: EvmGraphqlService,
    private nearGraphqlService: NearGraphqlService,
  ) {}

  async start(options: StartOptions) {
    while (true) {
      for (const chain of options.targetChains) {
        try {
          await this.run({
            ...options,
            targetChain: chain,
          });
        } catch (e: any) {
          logger.error(`run reporter errored: ${e.stack || e}`, {
            target: "reporter",
            breads: ["start"],
          });
        }
      }
      await setTimeout(1000);
    }
  }

  private async run(lifecycle: ReporterLifecycle) {
    const { targetChain } = lifecycle;
    // const todosByTargetChain = await this.evmGraphqlService.queryTodoRequestMade({
    //   endpoint: XAPIConfig.graphql.endpoint(targetChain.code),
    // });
    const aggtegatedEvents =
      await this.nearGraphqlService.queryAggregatedEvents({
        endpoint: XAPIConfig.graphql.endpoint("near"),
        ids: [
          "6277101735386680763835789423207666416102355444464034512862",
          "70021766616531051842153016788507494922593962344450640499185811457",
        ],
      });
    console.log(aggtegatedEvents);

    logger.debug(lifecycle.targetChain.code, {
      target: "reporter",
      breads: ["hello", "x"],
    });
  }
}
