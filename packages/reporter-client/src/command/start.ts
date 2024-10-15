import { Service } from "typedi";
import { setTimeout } from "timers/promises";
import {
  BasicGraphqlParams,
  EvmGraphqlService,
  NearGraphqlService,
} from "../services/graphql";

import { logger, StoredNearContractOptions, XAPIConfig, NearI, NearW } from "@ringdao/xapi-common";
import { HelixChainConf } from "@helixbridge/helixconf";

export interface BaseStartOptions {}

export interface StartOptions extends BaseStartOptions {
  targetChains: HelixChainConf[];
}

export interface ReporterLifecycle extends StartOptions {
  near: NearI
  targetChain: HelixChainConf;
}

@Service()
export class XAPIExporterStarter {
  constructor(
    private evmGraphqlService: EvmGraphqlService,
    private nearGraphqlService: NearGraphqlService,
  ) {}

  async start(options: StartOptions) {
    try {
      const nw = new NearW();
      const near = await nw.init();

      while (true) {
        for (const chain of options.targetChains) {
          try {
            logger.info(`==== start reporter for ${chain.code} ====`, {
              target: "reporter",
            });
            await this.run({
              ...options,
              near,
              targetChain: chain,
            });
          } catch (e: any) {
            logger.error(`run reporter errored: ${e.stack || e}`, {
              target: "reporter",
            });
          }
        }
        await setTimeout(1000);
      }
    } catch (e: any) {
      logger.error(`failed to start reporter: ${e.stack || e}`, {
        target: "reporter",
      });
    }
  }

  private async run(lifecycle: ReporterLifecycle) {
    const { targetChain } = lifecycle;
    const waites = await this.evmGraphqlService.queryTodoRequestMade({
      endpoint: XAPIConfig.graphql.endpoint(targetChain.code),
    });
    const aggregateds = await this.nearGraphqlService.queryAggregatedes({
      endpoint: XAPIConfig.graphql.endpoint("near"),
      ids: waites.map((item) => item.requestId),
    });

    const todos = waites.filter(
      (wait) => !aggregateds.find((agg) => agg.request_id === wait.requestId),
    );

    // console.log(todos);


    // ==========

    const c = lifecycle.near.contract(StoredNearContractOptions.ormpAggregator);
    console.log(c);

    logger.debug(lifecycle.targetChain.code, {
      target: "reporter",
      breads: ["hello", "x"],
    });
  }
}
