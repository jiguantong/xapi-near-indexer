import { Service } from 'typedi';
import { setTimeout } from "timers/promises";
import { GraphqlService, MpcOptions, XAPIResponse, Signature, PublishChainConfig } from "../services/graphql";
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import { Address } from '@ethereumjs/util';
import { NearEthereum } from '../near-lib/ethereum';
import { Common } from '@ethereumjs/common';
import { connect, Contract, KeyPair, keyStores, WalletConnection } from 'near-api-js';
import { KeyPairString } from 'near-api-js/lib/utils';
import { FailoverRpcProvider, JsonRpcProvider } from 'near-api-js/lib/providers';

export interface StartOptions {

}

@Service()
export class PublisherStarter {

    constructor(
        private graphqlService: GraphqlService,
    ) {
        this.graphqlService = new GraphqlService()
    }

    private nearEthereumMap: Record<string, NearEthereum> = {};

    async start(options: StartOptions) {
        const myKeyStore = new keyStores.InMemoryKeyStore();
        const PRIVATE_KEY: KeyPairString =
            "ed25519:by8kdJoJHu7uUkKfoaLd2J2Dp1q1TigeWMG123pHdu9UREqPcshCM223kWadm";
        // creates a public / private key pair using the provided private key
        const keyPair = KeyPair.fromString(PRIVATE_KEY);
        // adds the keyPair you created to keyStore
        await myKeyStore.setKey("testnet", "example-account.testnet", keyPair);

        const connectionConfig = {
            networkId: "testnet",
            keyStore: myKeyStore, // first create a key store
            nodeUrl: "https://rpc.testnet.near.org",
            walletUrl: "https://testnet.mynearwallet.com/",
            helperUrl: "https://helper.testnet.near.org",
            explorerUrl: "https://testnet.nearblocks.io",
        };
        const nearConnection = await connect(connectionConfig);
        // console.log(await nearConnection.account("example-account.testnet"));

        const c = new Contract(nearConnection.connection, "ormpaggregator.guantong.testnet", {
            viewMethods: ['get_response'],
            changeMethods: [],
            useLocalViewExecution: false
        });
        // @ts-ignore
        const r = await c.get_response({"request_id": "70021766616531051842153016788507494922593962344450640499185811462"});
        console.log("result", r);
        // const first = (await this.graphqlService.queryPublishEvent())[0];
        // const first = (await this.graphqlService.querySyncPublishChainConfigEvent())[0];

        // console.log(`call_data: ${first.call_data}`);
        // console.log(first, new Date());
        // await setTimeout(1000);
    }

    async triggerPublish(xapiResponse: XAPIResponse) {
        const chainId = xapiResponse.chain_id;
        const nearEth = this.getNearEthClient(chainId);

        // todo Fetch XAPI address from near chain config
        const xapiAddress = Address.fromString("0x6984ebE378F8cb815546Cb68a98807C1fA121A81");

        // todo Estimate gasLimit
        const gasLimit = 500000

        // Derive address
        const deriveAddress = await this.deriveXAPIAddress(chainId);
        const nonce = await nearEth.getNonce(deriveAddress);
        const balance = await nearEth.getBalance(deriveAddress);
        const { maxFeePerGas, maxPriorityFeePerGas } = await nearEth.queryGasPrice();

        // call Aggregator publish_external()
        (xapiResponse.request_id, { mpc_options: { nonce, gas_limit: gasLimit, max_fee_per_gas: maxFeePerGas, max_priority_fee_per_gas: maxPriorityFeePerGas } });
    }

    async triggerSyncConfig(publishChainConfig: PublishChainConfig) {
        const chainId = publishChainConfig.chain_id;
        const nearEth = this.getNearEthClient(chainId);

        // todo Fetch XAPI address from near chain config
        const xapiAddress = Address.fromString("0x6984ebE378F8cb815546Cb68a98807C1fA121A81");

        // todo Estimate gasLimit
        const gasLimit = 500000

        // Derive address
        const deriveAddress = await this.deriveXAPIAddress(chainId);
        const nonce = await nearEth.getNonce(deriveAddress);
        const balance = await nearEth.getBalance(deriveAddress);
        const { maxFeePerGas, maxPriorityFeePerGas } = await nearEth.queryGasPrice();

        // call Aggregator sync_publish_config_to_remote()
        (publishChainConfig.chain_id, { mpc_options: { nonce, gas_limit: gasLimit, max_fee_per_gas: maxFeePerGas, max_priority_fee_per_gas: maxPriorityFeePerGas } });
    }

    async relayMpcTx(chainId: string, contract: Address, calldata: string, signature: Signature, mpcOptions: MpcOptions) {
        const nearEth = this.getNearEthClient(chainId.toString());
        const transaction = FeeMarketEIP1559Transaction.fromTxData({
            nonce: BigInt(mpcOptions.nonce),
            gasLimit: BigInt(mpcOptions.gas_limit),
            maxFeePerGas: BigInt(mpcOptions.max_fee_per_gas),
            maxPriorityFeePerGas: BigInt(mpcOptions.max_priority_fee_per_gas),
            to: contract,
            data: calldata as any,
            value: 0,
        }, { common: new Common({ chain: chainId }) })

        // console.log("### transaction", transaction);

        const signedTransaction = await nearEth.reconstructSignature({ affine_point: signature.big_r_affine_point }, { scalar: signature.s_scalar }, signature.recovery_id, transaction);
        // console.log("### signedTransaction", signedTransaction);

        const txHash = await nearEth.relayTransaction(signedTransaction);
        console.log("### relayTx", txHash);
    }

    async deriveXAPIAddress(chainId: string) {
        const nearEth = this.getNearEthClient(chainId);
        return (await nearEth.deriveAddress("ormpaggregator.guantong.testnet", `XAPI-${chainId}`)).address;
    }

    getNearEthClient(chainId: string): NearEthereum {
        const cachedNearEthereum = this.nearEthereumMap[chainId];
        if (cachedNearEthereum) {
            return cachedNearEthereum;
        }
        // todo read rpc from config
        const ne = new NearEthereum("https://rpc.sepolia.org", chainId);
        this.nearEthereumMap[chainId] = ne;
        return ne;
    }
}