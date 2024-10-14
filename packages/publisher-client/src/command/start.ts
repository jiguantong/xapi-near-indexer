import { Service } from 'typedi';
import { setTimeout } from "timers/promises";
import { GraphqlService } from "../services/graphql";
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import { Address } from '@ethereumjs/util';
import { Ethereum } from '../near-lib/ethereum';
import { Common } from '@ethereumjs/common';

export interface StartOptions {

}

@Service()
export class PublisherStarter {

    constructor(
        private graphqlService: GraphqlService,
    ) {
        this.graphqlService = new GraphqlService()
    }

    async start(options: StartOptions) {
        const nearEth = new Ethereum("https://rpc.sepolia.org", '11155111');

        // Derive address
        const deriveAddress = (await nearEth.deriveAddress("ormpaggregator.guantong.testnet", "XAPI-11155111")).address;
        console.log(`deriveAddress: ${deriveAddress}`);

        const nonce = await nearEth.getNonce(deriveAddress);
        console.log(`nonce: ${nonce}`);

        const balance = await nearEth.getBalance(deriveAddress);
        console.log(`balance: ${balance}`);

        const { maxFeePerGas, maxPriorityFeePerGas } = await nearEth.queryGasPrice();
        console.log(`maxFeePerGas: ${maxFeePerGas}, maxPriorityFeePerGas: ${maxPriorityFeePerGas}`);

        const first = (await this.graphqlService.queryPublishEvent())[0];
        // const first = (await this.graphqlService.querySyncPublishChainConfigEvent())[0];

        console.log(`call_data: ${first.call_data}`);

        const transaction = FeeMarketEIP1559Transaction.fromTxData({
            nonce: BigInt(first.mpc_options.nonce),
            gasLimit: BigInt(first.mpc_options.gas_limit),
            maxFeePerGas: BigInt(first.mpc_options.max_fee_per_gas),
            maxPriorityFeePerGas: BigInt(first.mpc_options.max_priority_fee_per_gas),
            to: Address.fromString(first.publish_chain_config.xapi_address),
            data: first.call_data as any,
            value: 0,
        }, { common: new Common({ chain: 11155111 }) })

        // console.log("### transaction", transaction);

        const signatureData = first.signature;
        const signedTransaction = await nearEth.reconstructSignature({ affine_point: signatureData.big_r_affine_point }, { scalar: signatureData.s_scalar }, signatureData.recovery_id, transaction);
        // console.log("### signedTransaction", signedTransaction);

        const txHash = await nearEth.relayTransaction(signedTransaction);
        console.log("### relayTx", txHash);

        // console.log(first, new Date());
        // await setTimeout(1000);
    }
}