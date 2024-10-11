import {Service} from 'typedi';

export interface GraphqlQuery {
  endpoint: string
}

export interface ReporterRequired {
  quorum: number
  threshold: number
}

export interface RequestMade {
  requestId: bigint
  aggregator: string
  requestData: string
  requester: string
}

abstract class AbstractGraphqlService {

}

@Service()
export class EvmGraphqlService extends AbstractGraphqlService {

  async queryRequestMade(query: GraphqlQuery): Promise<RequestMade[]> {
    return []
  }
}

@Service()
export class NearGraphqlService extends AbstractGraphqlService {

}
