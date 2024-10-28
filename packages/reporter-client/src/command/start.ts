import { Service } from "typedi";
import { setTimeout } from "timers/promises";
import { EvmGraphqlService, NearGraphqlService } from "../services/graphql";
import * as nearAPI from "near-api-js";

import {
  Datasource,
  AuthValuePathString,
  RequestMade,
  Report,
  Answer,
  Tools,
} from "@ringdao/xapi-common";

import axios from "axios";

import {
  logger,
  XAPIConfig,
  NearI,
  NearW,
  ReporterRequired,
  XAPIResponse,
  TopStaked,
} from "@ringdao/xapi-common";
import { HelixChain, HelixChainConf } from "@helixbridge/helixconf";
import { KeyPairString } from "near-api-js/lib/utils";

export interface BaseStartOptions {}

export interface StartOptions extends BaseStartOptions {
  rewardAddress: string;
  nearAccount: string;
  nearPrivateKey: KeyPairString;
  minimumRewards: Record<string, bigint>;
}

export interface ReporterLifecycle extends StartOptions {
  near: NearI;
  aggregatorId: string;
  targetChain: HelixChainConf;
  minimumReward?: bigint;
}

const MAX_REPORTER_DEPOSIT = 100000000000000000000000n;

@Service()
export class XAPIExporterStarter {
  private _nearInstance: Record<string, NearI> = {};
  private _aggregatorStakingMap: Record<string, string> = {};
  private readonly _nearGraphqlEndpoint: string =
    XAPIConfig.graphql.endpoint("near");

  constructor(
    private evmGraphqlService: EvmGraphqlService,
    private nearGraphqlService: NearGraphqlService,
  ) {}

  private async near(
    options: StartOptions,
    chain: HelixChainConf,
  ): Promise<NearI> {
    const networkId = chain.testnet ? "testnet" : "mainnet";
    const cachedNear = this._nearInstance[networkId];
    if (cachedNear) return cachedNear;

    const nw = new NearW();
    const near = await nw.init({
      networkId,
      account: {
        privateKey: options.nearPrivateKey,
        accountId: options.nearAccount,
      },
    });
    this._nearInstance[networkId] = near;
    return near;
  }

  async start(options: StartOptions) {
    while (true) {
      try {
        const aggregators = await this.nearGraphqlService.queryAggregators({
          endpoint: this._nearGraphqlEndpoint,
        });

        for (const aggregator of aggregators) {
          for (const supportedChain of aggregator.supported_chains) {
            const chain = HelixChain.get(supportedChain);
            if (!chain) continue;
            try {
              const near = await this.near(options, chain);
              logger.info(`==== start reporter for ${chain.code} ====`, {
                target: "reporter",
              });
              await this.run({
                ...options,
                near,
                aggregatorId: aggregator.id,
                targetChain: chain,
                minimumReward: options.minimumRewards[chain.code],
              });
            } catch (e: any) {
              logger.error(`run reporter errored: ${e.stack || e}`, {
                target: "reporter",
              });
            }
          }
        }
        await setTimeout(1000);
      } catch (e: any) {
        logger.error(`failed to start reporter: ${e.stack || e}`, {
          target: "reporter",
        });
        await setTimeout(3000);
      }
    }
  }

  private async _stakingContract(
    lifecycle: ReporterLifecycle,
    aggeratorContractId: string,
  ): Promise<nearAPI.Contract> {
    const { near } = lifecycle;
    const scid = this._aggregatorStakingMap[aggeratorContractId];
    if (scid) {
      return near.contractStaking(scid);
    }
    const contract = near.contractAggregator(aggeratorContractId);
    // @ts-ignore
    const stakingContract: string = await contract.get_staking_contract();
    this._aggregatorStakingMap[aggeratorContractId] = stakingContract;
    return near.contractStaking(stakingContract);
  }

  private async run(lifecycle: ReporterLifecycle) {
    const { near, targetChain, minimumReward } = lifecycle;
    const aggregator = near.contractAggregator(lifecycle.aggregatorId);

    // @ts-ignore
    const datasources: Datasource[] = await aggregator.get_data_sources();
    if (!datasources || !datasources.length) {
      logger.warn(
        `missing datasource for [${lifecycle.aggregatorId}] skip this`,
        {
          target: "reporter",
        },
      );
      return;
    }

    const reporterRequired: ReporterRequired =
      // @ts-ignore
      await aggregator.get_reporter_required();

    const waites = await this.evmGraphqlService.queryTodoRequestMade({
      endpoint: XAPIConfig.graphql.endpoint(targetChain.code),
      aggregator: lifecycle.aggregatorId,
      minimumRewards: minimumReward
        ? minimumReward * BigInt(reporterRequired.quorum)
        : 0n,
    });

    const aggregatedEvents =
      await this.nearGraphqlService.queryAggregatedeEvents({
        endpoint: this._nearGraphqlEndpoint,
        ids: waites.map((item) => item.requestId),
      });

    const possibleTodos = waites.filter(
      (wait) =>
        !aggregatedEvents.find((agg) => agg.request_id === wait.requestId),
    );

    const todos: RequestMade[] = [];
    for (const todo of possibleTodos) {
      // @ts-ignore
      const response: XAPIResponse | undefined = await aggregator.get_response({
        request_id: todo.requestId,
      });
      if (!response || (response && response.status === "FETCHING")) {
        todos.push(todo);
      }
    }
    if (!todos.length) {
      logger.debug("not have any todo jobs", { target: "report" });
      return;
    }

    const maxResultLength: number =
      // @ts-ignore
      await aggregator.get_max_result_length();

    const stakingContract = await this._stakingContract(
      lifecycle,
      lifecycle.aggregatorId,
    );
    for (const todo of todos) {
      // @ts-ignore
      const reports: Report[] | undefined = await aggregator.get_reports({
        request_id: todo.requestId,
      });
      if (
        reports &&
        reports.find(
          (item) =>
            item.reporter?.toLowerCase() === near.accountId.toLowerCase(),
        )
      ) {
        logger.info(
          `you have already report this ${todo.requestId} from ${targetChain}, skip this`,
          { target: "reporter" },
        );
        return;
      }

      // @ts-ignore
      const topStakeds: TopStaked[] = await stakingContract.get_top_staked({
        top: reporterRequired.quorum,
      });
      const includeMyself = topStakeds.find(
        (item) =>
          item.account_id.toLowerCase() === near.accountId.toLowerCase(),
      );
      if (!includeMyself) {
        continue;
      }

      const answers = await this.fetchApi(datasources, todo, maxResultLength);
      for (const answer of answers) {
        if (!answer.result) {
          continue;
        }
        const resultLength = answer.result.length;
        if (resultLength > maxResultLength) {
          answer.result = undefined;
          answer.error = `the result is too long, maxLength: ${maxResultLength}, currentLength: ${resultLength}`;
        }
      }

      let times = 0;
      while (true) {
        times += 1;
        if (times > 3) {
          logger.warn("failed report 3 times, skipp this round.");
          break;
        }
        try {
          const report: Report = {
            request_id: todo.requestId,
            reward_address: lifecycle.rewardAddress,
            answers,
          };
          const reporteDeposit =
            // @ts-ignore
            await aggregator.estimate_storage_deposit(report);
          // @ts-ignore
          const _reported = await aggregator.report({
            signerAccount: near.nearAccount(),
            args: report,
            gas: "300000000000000",
            amount: this._bigIntMin([
              MAX_REPORTER_DEPOSIT,
              BigInt(reporteDeposit),
            ]),
          });
          break;
        } catch (e: any) {
          logger.warning(
            `failed to report: ${e.message || e.msg || e}, times: ${times}`,
            {
              target: "reporter",
            },
          );
          await setTimeout(2000);
        }
      }
    }

    logger.debug(lifecycle.targetChain.code, {
      target: "reporter",
      breads: ["hello", "x"],
    });
  }

  private async fetchApi(
    datasources: Datasource[],
    todo: RequestMade,
    maxResultLength: number,
  ): Promise<Answer[]> {
    const answers: Answer[] = [];
    for (const ds of datasources) {
      let times = 0;
      while (true) {
        times += 1;
        try {
          const headers: Record<string, any> = {};
          const axiosOptions: any = {
            responseType: "text",
            method: ds.method,
            url: ds.url,
            headers,
          };

          if (ds.method.toLowerCase() === "get") {
            const params = this._mergeData(ds.query_json, todo.requestData);
            axiosOptions.params = params;
            if (ds.body_json) {
              axiosOptions.data = ds.body_json;
            }
          } else {
            if (ds.query_json) {
              axiosOptions.params = ds.query_json;
            }
            axiosOptions.data = this._mergeData(ds.body_json, todo.requestData);
          }

          const authValue = this._readAuth(ds.auth.value_path);
          if (authValue) {
            const place_path = ds.auth.place_path;
            if (place_path.indexOf("headers.") === 0) {
              const headerName = place_path.replace("headers.", "");
              headers[headerName] = authValue;
            }
            if (place_path.indexOf("body.") === 0) {
              const fieldName = place_path.replace("body.", "");
              if (!axiosOptions.data) {
                axiosOptions.data = {};
              }
              this._setNestedProperty(axiosOptions.data, fieldName, authValue);
            }
            if (place_path.indexOf("query.") === 0) {
              const queryName = place_path.replace("query.", "");
              if (!axiosOptions.params) {
                axiosOptions.params = {};
              }
              axiosOptions.params[queryName] = authValue;
            }
          }
          const response = await axios(axiosOptions);
          answers.push({
            data_source_name: ds.name,
            result: response.data,
          });
          break;
        } catch (e: any) {
          logger.warn(
            `failed call api, times ${times} error: ${e.message || e.msg || e}`,
            { target: "reporter" },
          );
          if (times < 3) {
            await setTimeout(5000);
            continue;
          }

          answers.push({
            data_source_name: ds.name,
            error: Tools.ellipsisText({
              text: e.message ?? e.msg ?? "ERROR_CALL_API",
              len: maxResultLength - 3,
              suffix: "...",
            }),
          });
          break;
        }
      }
    }
    return answers;
  }

  private _readAuth(valuePath: AuthValuePathString): string | undefined {
    if (!valuePath) return undefined;
    if (valuePath.indexOf("env.") === 0) {
      const envKey = valuePath.replace("env.", "");
      return process.env[envKey];
    }
    return undefined;
  }

  private _mergeData(first: string, second: string): any | undefined {
    let fv = first,
      sv = second;
    if (typeof fv === "string") {
      try {
        fv = JSON.parse(fv);
      } catch (ignore: any) {
        logger.warn(
          `failed to parse data from datasource: ${ignore} will use raw value`,
          { target: "reporter" },
        );
      }
    }
    try {
      sv = JSON.parse(sv);
    } catch (ignore: any) {
      logger.warn(
        `failed to parse data from request made: ${ignore} will use raw value`,
        { target: "reporter" },
      );
    }
    const tfv = typeof fv;
    const tsv = typeof sv;
    if (tfv !== tsv) {
      throw new Error(
        `two data have different types: ${tfv} != ${tsv}. ${JSON.stringify(
          fv,
        )} |||| ${JSON.stringify(sv)}`,
      );
    }
    // object
    if (tfv === "object") {
      if (Array.isArray(fv) && Array.isArray(sv)) {
        return [...fv, ...sv];
      }
      if (!Array.isArray(fv) && Array.isArray(sv)) {
        return [...sv].push(fv);
      }
      if (Array.isArray(fv) && !Array.isArray(sv)) {
        throw new Error(
          `can not merge array to object ${JSON.stringify(
            fv,
          )} |||| ${JSON.stringify(sv)}`,
        );
      }
      if (!Array.isArray(fv) && !Array.isArray(sv)) {
        return Object.assign({}, fv, sv);
      }
      throw new Error("unreachable");
    }
    // number
    // bigint
    // string
    //# return second value directly, if there have another strategy please update this.
    return sv;
  }

  private _setNestedProperty(obj: any, path: string, value: any) {
    const keys = path.split(".");
    let current = obj;

    keys.forEach((key, index) => {
      const arrayMatch = key.match(/^([a-zA-Z0-9_]+)\[(\d+)\]$/);

      if (arrayMatch) {
        const arrayKey = arrayMatch[1];
        const arrayIndex = parseInt(arrayMatch[2], 10);

        if (!current[arrayKey]) {
          current[arrayKey] = [];
        }

        if (!current[arrayKey][arrayIndex]) {
          current[arrayKey][arrayIndex] =
            keys.length === index + 1 ? value : {};
        }

        current = current[arrayKey][arrayIndex];
      } else {
        if (index === keys.length - 1) {
          current[key] = value;
        } else {
          if (!current[key]) {
            current[key] = {};
          }
          current = current[key];
        }
      }
    });
  }

  private _bigIntMin(args: any[]) {
    return args.reduce((m, e) => (e < m ? e : m));
  }
}
