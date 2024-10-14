import axios from "axios";
import { Service } from "typedi";

import { logger, Tools } from "@ringdao/xapi-common";
import chalk = require("chalk");

export interface BasicGraphqlParams {
  endpoint: string;
}

interface GraphqlQuery extends BasicGraphqlParams {
  query: string;
  variables?: Record<string, any>;
}

export interface QueryWithIds extends BasicGraphqlParams {
  ids: string[];
}

export interface XAPIResponseParams extends QueryWithIds {
  status?: string[];
}

export interface ReporterRequired {
  quorum: number;
  threshold: number;
}

export interface RequestMade {
  id: string;
  requestId: bigint;
  aggregator: string;
  requestData: string;
  requester: string;
  blockNumber: bigint;
  blockTimestamp: bigint;
  transactionHash: string;
  fulfilled: number;
}

export interface XAPIResponse {
  valid_reporters: string[];
  updated_at: string;
  status: string;
  started_at: string;
  result: string;
  request_id: string;
  id: string;
  chain_id: string;
  reporter_reward_addresses: string[];
}

abstract class AbstractGraphqlService {
  async post(query: GraphqlQuery) {
    const options: any = {
      query: query.query,
    };
    if (query.variables) {
      options.variables = query.variables;
    }
    const response = await axios.post(query.endpoint, options, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    const { errors, data } = response.data;
    if (errors) {
      throw new Error(JSON.stringify(errors));
    }
    // const gralphData = data.data;

    // #### log
    const logQuery = Tools.shortLog({
      input: `> ${query.query
        .replaceAll("   ", " ")
        .trim()
        .replaceAll("\n", "\n>")}`,
      len: 50,
    });
    const logData = Tools.shortLog({
      input: JSON.stringify(data),
      len: 100,
    });
    logger.debug(`==> ${query.endpoint}\n${logQuery}\n${logData}`);
    // #### log
    return data;
  }
}

@Service()
export class EvmGraphqlService extends AbstractGraphqlService {
  async queryTodoRequestMade(
    params: BasicGraphqlParams,
  ): Promise<RequestMade[]> {
    const query = `
    query QueryTodoRequestMades {
      requestMades(
        where: {fulfilled: 0},
        orderBy: id,
        orderDirection: asc,
        first: 50
      ) {
        id
        requestId
        aggregator
        requestData
        requester
        blockNumber
        blockTimestamp
        transactionHash
        fulfilled

        blockTimestamp
        blockNumber
      }
    }
    `;
    const data = await super.post({
      ...params,
      query,
    });
    return data["requestMades"];
  }
}

@Service()
export class NearGraphqlService extends AbstractGraphqlService {
  async queryAggregatedes(params: QueryWithIds): Promise<XAPIResponse> {
    const query = `
    query QueryAggregatedEvents(
      ${params.ids ? "$ids: [String]" : ""}
    ) {
      aggregatedEvents(
        where: {
          ${params.ids ? "request_id_in: $ids" : ""}
        }
      ) {
        valid_reporters
        updated_at
        status
        started_at
        result
        request_id
        reporter_reward_addresses
        id
        chain_id
      }
    }
    `;
    const data = await super.post({
      ...params,
      query,
      variables: {
        ids: params.ids,
      },
    });
    return data["aggregatedEvents"];
  }
}
