import { Service } from 'typedi';
import { setTimeout } from "timers/promises";
import { GraphqlService } from "../services/graphql";

export interface StartOptions {

}

@Service()
export class MPCRelayerStarter {

    constructor(
        private graphqlService: GraphqlService,
    ) {
    }

    async start(options: StartOptions) {
        while (true) {
            const rms = await this.graphqlService.queryRequestMade();
            console.log(rms, new Date());
            await setTimeout(1000);
        }
    }

}