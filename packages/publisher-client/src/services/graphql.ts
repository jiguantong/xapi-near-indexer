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
  PublishEvent,
  SyncPublishChainConfigEvent,
} from "@ringdao/xapi-common";

export interface QueryWithAggregator extends BasicGraphqlParams {
  aggregator: string;
}

export interface QueryWithAggregatorIds extends BasicGraphqlParams {
  aggregator: string;
  ids: string[];
}

export interface QueryWithPublishChain extends QueryWithAggregator {
  chainId: string;
}

export interface QueryWithVersion extends QueryWithAggregator {
  version: string;
}

export interface QueryWithChainVersion extends QueryWithPublishChain {
  version: string;
}

export interface QueryWithRequestId extends QueryWithAggregator {
  requestId: string;
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
        aggregator: params.aggregator,
      },
    });
    return data["requestMades"];
  }

  async queryAggregatorConfig(
    params: QueryWithVersion,
  ): Promise<{ version: string }> {
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
        aggregator: params.aggregator,
      },
    });
    return data["aggregatorConfigSets"].length == 0
      ? null
      : data["aggregatorConfigSets"][0];
  }
}

@Service()
export class NearGraphqlService extends AbstractGraphqlService {
  async queryAggregatedeEvents(
    params: QueryWithAggregatorIds,
  ): Promise<XAPIResponse[]> {
    const query = `
    query QueryAggregatedEvents(
      $ids: [String]
      $aggregator: String
    ) {
      aggregatedEvents(
        where: {
          request_id_in: $ids
          aggregator: $aggregator
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
        aggregator: params.aggregator,
      },
    });
    return data["aggregatedEvents"];
  }

  async queryLatestPublishConfig(
    params: QueryWithPublishChain,
  ): Promise<PublishChainConfig> {
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
        aggregator: params.aggregator,
      },
    });
    return data["setPublishChainConfigEvents"].length == 0
      ? null
      : data["setPublishChainConfigEvents"][0];
  }

  async queryAggregators(params: QueryWithIds): Promise<Aggregator[]> {
    const query =
      params.ids && params.ids.length
        ? `
    query QueryAggregators($first: Int!, $skip: Int!, $ids: [String!]!) {
      aggregators(
        first: $first,
        skip: $skip,
        where: {
          id_in: $ids
        }
      ) {
        supported_chains
        id
      }
    }
    `
        : `
    query QueryAggregators($first: Int!, $skip: Int!) {
      aggregators(first: $first, skip: $skip) {
        supported_chains
        id
      }
    }
    `;
    const first = 100;
    let skip = 0;
    const aggregators: Aggregator[] = [];
    while (true) {
      const data = await super.post({
        ...params,
        query,
        variables: {
          first,
          skip,
          ids: params.ids,
        },
      });
      const pd = data["aggregators"];
      if (!pd || !pd.length) break;
      aggregators.push(...pd);
      skip = skip + first;
    }
    return aggregators;
  }

  async queryPublishSignature(
    params: QueryWithRequestId,
  ): Promise<PublishEvent> {
    const query = `
    query PublishEvents(
      $request_id: String
      $aggregator: String
    ) {
      publishEvents(first: 1, orderBy: id, orderDirection: desc,
        where: {
          request_id: $request_id
          aggregator: $aggregator
        }
      ) {
        id
        publish_chain_config {
          chain_id
          id
          xapi_address
          reporters_fee
          publish_fee
          version
          reward_address
        }
        request_id
        response {
          chain_id
          id
          reporter_reward_addresses
          request_id
          result
          started_at
          status
          updated_at
          valid_reporters
        }
        signature {
          big_r_affine_point
          id
          recovery_id
          s_scalar
        }
        call_data
        mpc_options {
          gas_limit
          id
          max_fee_per_gas
          max_priority_fee_per_gas
          nonce
        }
        aggregator
      }
    }
    `;
    const data = await super.post({
      ...params,
      query,
      variables: {
        request_id: params.requestId,
        aggregator: params.aggregator,
      },
    });
    return data["publishEvents"].length == 0 ? null : data["publishEvents"][0];
  }

  async querySyncConfigSignature(
    params: QueryWithChainVersion,
  ): Promise<SyncPublishChainConfigEvent> {
    const query = `
    query SyncPublishChainConfigEvents(
      $aggregator: String
      $chain_id: BigInt
      $version: BigInt
    ) {
      syncPublishChainConfigEvents(first: 1, orderBy: id, orderDirection: desc,
        where: {
          aggregator: $aggregator,
          chain_id: $chain_id,
          version: $version
        }
      ) {
        call_data
        chain_id
        id
        mpc_options {
          gas_limit
          id
          max_fee_per_gas
          max_priority_fee_per_gas
          nonce
        }
        publish_chain_config {
          chain_id
          id
          publish_fee
          reporters_fee
          reward_address
          version
          xapi_address
        }
        signature {
          big_r_affine_point
          id
          recovery_id
          s_scalar
        }
        version
        xapi_address
        aggregator
      }
    }
    `;
    const data = await super.post({
      ...params,
      query,
      variables: {
        chain_id: params.chainId,
        version: params.version,
        aggregator: params.aggregator,
      },
    });
    return data["syncPublishChainConfigEvents"].length == 0
      ? null
      : data["syncPublishChainConfigEvents"][0];
  }
}
