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
}

export interface ReporterLifecycle extends StartOptions {
  near: NearI;
  targetChain: HelixChainConf;
}

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
        const targetChainIds: string[] = [];
        for (const aggregator of aggregators) {
          const scs = aggregator.supported_chains;
          for (const sc of scs) {
            if (targetChainIds.indexOf(sc) !== -1) continue;
            targetChainIds.push(sc);
          }
        }
        const targetChains = targetChainIds
          .map((item) => HelixChain.get(item))
          .filter((item) => item != undefined);

        for (const chain of targetChains) {
          try {
            const near = await this.near(options, chain);
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
    const { near, targetChain } = lifecycle;
    const waites = await this.evmGraphqlService.queryTodoRequestMade({
      endpoint: XAPIConfig.graphql.endpoint(targetChain.code),
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
      const aggeregator = near.contractAggregator(todo.aggregator);
      // @ts-ignore
      const response: XAPIResponse = await aggeregator.get_response({
        request_id: todo.requestId,
      });
      if (response.status !== "FETCHING") continue;
      todos.push(todo);
    }
    if (!todos.length) {
      logger.debug("not have any todo jobs", { target: "report" });
      return;
    }

    for (const todo of todos) {
      const aggregator = near.contractAggregator(todo.aggregator);
      const reporterRequired: ReporterRequired =
        // @ts-ignore
        await aggregator.get_reporter_required();

      const stakingContract = await this._stakingContract(
        lifecycle,
        todo.aggregator,
      );

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
      // @ts-ignore
      const datasources: Datasource[] = await aggregator.get_data_sources();
      if (!datasources || !datasources.length) {
        logger.debug(`missing datasource for [${todo.aggregator}] skip this`, {
          target: "reporter",
        });
        continue;
      }

      let reported: any;
      try {
        const answers = await this.fetchApi(datasources, todo);
        const report: Report = {
          request_id: todo.requestId,
          reward_address: lifecycle.rewardAddress,
          answers,
        };
        // @ts-ignore
        const reporteDeposit = await aggregator.estimate_report_deposit(report);
        // @ts-ignore
        reported = await aggregator.report({
          signerAccount: near.nearAccount(),
          args: report,
          gas: "300000000000000",
          amount: reporteDeposit,
        });
      } catch (e: any) {
        const answers: Answer[] = [];
        for (const ds of datasources) {
          answers.push({
            data_source_name: ds.name,
            error: Tools.ellipsisText({
              text: `${e.message || e.msg || "ERROR_REPORT"}`,
              len: 480,
            }),
          });
        }
        const report: Report = {
          request_id: todo.requestId,
          reward_address: lifecycle.rewardAddress,
          answers,
        };
        // @ts-ignore
        const reporteDeposit = await aggregator.estimate_report_deposit(report);
        // @ts-ignore
        reported = await aggregator.report({
          signerAccount: near.nearAccount(),
          args: report,
          gas: "300000000000000",
          amount: reporteDeposit,
        });
      }
      console.log(reported);
    }

    logger.debug(lifecycle.targetChain.code, {
      target: "reporter",
      breads: ["hello", "x"],
    });
  }

  private async fetchApi(
    datasources: Datasource[],
    todo: RequestMade,
  ): Promise<Answer[]> {
    const answers: Answer[] = [];
    for (const ds of datasources) {
      try {
        const headers: Record<string, any> = {
          "x-app": "xapi-reporter",
        };
        const reqData = this._mergeData(ds.body_json, todo.requestData);
        const params = {};
        const authValue = this._readAuth(ds.auth.value_path);
        if (authValue) {
          const place_path = ds.auth.place_path;
          if (place_path.indexOf("headers.") === 0) {
            const headerName = place_path.replace("headers.", "");
            headers[headerName] = authValue;
          }
          if (place_path.indexOf("body.") === 0) {
            const fieldName = place_path.replace("body.", "");
            this._setNestedProperty(reqData, fieldName, authValue);
          }
          if (place_path.indexOf("query.") === 0) {
            const queryName = place_path.replace("query.", "");
            this._setNestedProperty(params, queryName, authValue);
          }
        }
        const axiosOptions: any = {
          method: ds.method,
          url: ds.url,
          // data: ",",
          headers,
        };
        if (ds.method.toLowerCase() === "get") {
          axiosOptions.params = Object.assign({}, reqData, params);
        } else {
          axiosOptions.params = params;
          axiosOptions.data = reqData;
        }
        const response = await axios(axiosOptions);
        console.log(response);
        answers.push({
          data_source_name: ds.name,
          result: response.data,
        });
      } catch (e: any) {
        logger.warn(
          `failed call api, will report error: ${e.message || e.msg || e}`,
          { target: "reporter" },
        );
        answers.push({
          data_source_name: ds.name,
          error: Tools.ellipsisText({
            text: e.message ?? e.msg ?? "ERROR_CALL_API",
            len: 480,
            suffix: "...",
          }),
        });
      }
    }
    return answers;
  }

  private _readAuth(valuePath: AuthValuePathString): string | undefined {
    if (!valuePath) return undefined;
    if (valuePath.indexOf("env.") === 0) {
      const envKey = valuePath.replace("env.", "");
      return process.env[envKey.toUpperCase()];
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
      if (Array.isArray(fv) && Array.isArray(sv)) {
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
}
