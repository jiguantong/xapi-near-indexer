import { Service } from 'typedi';

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

abstract class AbstractGraphqlQuery {
    abstract queryRequestMade(): Promise<RequestMade[]>;
}

@Service()
export class GraphqlService extends AbstractGraphqlQuery {

    private readonly thegraph: ThegraphService = new ThegraphService();

    async queryRequestMade(): Promise<RequestMade[]> {
        return this.thegraph.queryRequestMade();
    }
}

class ThegraphService extends AbstractGraphqlQuery {
    async queryRequestMade(): Promise<RequestMade[]> {
        return [];
    }
}