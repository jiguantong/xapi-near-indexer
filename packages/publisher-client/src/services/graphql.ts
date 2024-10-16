import axios from 'axios';
import { Service } from 'typedi';
import { logger, Tools } from "@ringdao/xapi-common";

export interface RequestMade {
    id: string
    requestId: string
    aggregator: string
    requestData: string
    requester: string
    blockNumber: string
    blockTimestamp: string
    transactionHash: string
    fulfilled: number
    xapiAddress: string
  }

export interface XAPIResponse {
    id: string
    request_id: string
    valid_reporters: string[]
    reporter_reward_addresses: string[]
    started_at: string
    updated_at: string
    status: string
    result: string
    chain_id: string
    aggregator?: string
}

export interface PublishChainConfig {
    id: string
    chain_id: string
    xapi_address: string
    reporters_fee: string
    publish_fee: string
    reward_address: string
    version: string
    aggregator?: string
}

export interface Signature {
    id: string
    big_r_affine_point: string
    recovery_id: number
    s_scalar: string
}

export interface PublishEvent {
    id: string
    request_id: string
    response: XAPIResponse
    publish_chain_config: PublishChainConfig
    signature: Signature
    call_data: string
    mpc_options: MpcOptions
    aggregator: string
}

export interface SyncPublishChainConfigEvent {
    id: String
    chain_id: String
    xapi_address: String
    version: String
    call_data: String
    signature: Signature
    mpc_options: MpcOptions
    publish_chain_config: PublishChainConfig
    aggregator: string
}

export interface MpcOptions {
    id: String
    nonce: string
    gas_limit: string
    max_fee_per_gas: string
    max_priority_fee_per_gas: string
}

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
          throw new Error(`[${query.endpoint}] \n${JSON.stringify(options)} \nresposne is: ${JSON.stringify(errors)}`);
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
        logger.debug(`--> ${query.endpoint}\n${logQuery}\n${logData}`);
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
        xapiAddress

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
    async queryAggregatedeEvents(params: QueryWithIds): Promise<XAPIResponse[]> {
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
