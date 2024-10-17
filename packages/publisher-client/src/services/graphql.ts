import axios from "axios";
import { Service } from "typedi";
import {
  logger,
  Tools,
  BasicGraphqlParams,
  QueryWithIds,
  RequestMade,
  XAPIResponse,
} from "@ringdao/xapi-common";

interface GraphqlQuery extends BasicGraphqlParams {
  query: string;
  variables?: Record<string, any>;
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
      throw new Error(
        `[${query.endpoint}] \n${JSON.stringify(
          options,
        )} \nresposne is: ${JSON.stringify(errors)}`,
      );
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
