import { Service } from 'typedi';
import { setTimeout } from "timers/promises";
import { GraphqlService } from "../services/graphql";

export interface StartOptions {

}

@Service()
export class PublisherStarter {

    constructor(
        private graphqlService: GraphqlService,
    ) {
        // graphqlService.endpoint = "https://api.studio.thegraph.com/query/66211/xapi-near/version/latest";
    }

    async start(options: StartOptions) {
        while (true) {
            const rms = await this.graphqlService.queryPublishEvent();
            console.log(rms, new Date());
            await setTimeout(1000);
        }
    }
}