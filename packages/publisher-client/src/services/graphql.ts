import { Service } from "typedi";
import {
  logger,
  Tools,
  BasicGraphqlParams,
  QueryWithIds,
  RequestMade,
  XAPIResponse,
  AbstractGraphqlService,
  Aggregator,
  PublishChainConfig,
} from "@ringdao/xapi-common";

export interface QueryWithAggregator extends BasicGraphqlParams {
  aggregator: string,
}

export interface QueryWithPublishChain extends QueryWithAggregator {
  chainId: string
}

export interface QueryWithVersion extends QueryWithAggregator {
  version: string
}

@Service()
export class EvmGraphqlService extends AbstractGraphqlService {
  async queryTodoRequestMade(
    params: QueryWithAggregator,
  ): Promise<RequestMade[]> {
    const query = `
    query QueryTodoRequestMades(
      $aggregator: String,
    )
     {
      requestMades(
        where: {fulfilled: 0, aggregator: $aggregator},
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
      variables: {
        aggregator: params.aggregator
      }
    });
    return data["requestMades"];
  }

  async queryAggregatorConfig(params: QueryWithVersion): Promise<{version: string}> {
    const query = `
    query PublishChainConfigs(
      $version: BigInt
      $aggregator: String
    ) {
      aggregatorConfigSets(first: 1, 
        where: {
          version_gte: $version
          aggregator: $aggregator
        },
        orderBy: version
        orderDirection: desc
      ) {
          version
      }
    }
    `;
    const data = await super.post({
      ...params,
      query,
      variables: {
        version: params.version,
        aggregator: params.aggregator
      },
    });
    return data["aggregatorConfigSets"].length == 0 ? null : data["aggregatorConfigSets"][0];
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
        aggregator
        error_code
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

  async queryLatestPublishConfig(params: QueryWithPublishChain): Promise<PublishChainConfig> {
    const query = `
    query PublishChainConfigs(
      $chain_id: BigInt
      $aggregator: String
    ) {
      setPublishChainConfigEvents(first: 1, 
        where: {
          chain_id: $chain_id
          aggregator: $aggregator
        },
        orderBy: version
        orderDirection: desc
      ) {
          chain_id
          id
          publish_fee
          reporters_fee
          reward_address
          xapi_address
          version
          aggregator
      }
    }
    `;
    const data = await super.post({
      ...params,
      query,
      variables: {
        chain_id: params.chainId,
        aggregator: params.aggregator
      },
    });
    return data["setPublishChainConfigEvents"].length == 0 ? null : data["setPublishChainConfigEvents"][0];
  }

  async queryAllAggregators(params: BasicGraphqlParams): Promise<Aggregator[]> {
    const query = `
    query AllAggregators {
      aggregators(first: 100) {
        id
        supported_chains
      }
    }
    `;
    const data = await super.post({
      ...params,
      query,
      variables: {},
    });
    return data["aggregators"];
  }
}
