import { Service } from 'typedi';
import { setTimeout } from "timers/promises";
import { EvmGraphqlService, NearGraphqlService } from "../services/graphql";
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import { Address } from '@ethereumjs/util';
import { NearEthereum } from '../near-lib/ethereum';
import { Common } from '@ethereumjs/common';
import {
    logger,
    XAPIConfig,
    NearI,
    NearW,
    MpcOptions, XAPIResponse, Signature, PublishChainConfig, RequestMade,
    Aggregator,
} from "@ringdao/xapi-common";
import { HelixChain, HelixChainConf } from "@helixbridge/helixconf";

import xapiAbi from "../abis/xapi.abi.json";
import { PublisherStorage } from '../services/storage';
import { Account as NearAccount } from 'near-api-js';
import { KeyPairString } from "near-api-js/lib/utils";

const homedir = require('os').homedir();

export interface StartOptions {
    nearAccount: string,
    nearPrivateKey: KeyPairString,
    testnet: boolean,
}

export interface PublisherLifecycle extends StartOptions {
    near: NearI;
    targetChain: HelixChainConf;
    nearEthereum: NearEthereum;
    aggregator: string;
    cache: PublisherStorage;
}

@Service()
export class PublisherStarter {
    private _nearInstance: Record<string, NearI> = {};

    private _nearGraphqlEndpoint?: string;

    constructor(
        private evmGraphqlService: EvmGraphqlService,
        private nearGraphqlService: NearGraphqlService
    ) {
    }

    private async near(
        options: StartOptions,
        chain: HelixChainConf,
    ): Promise<NearI> {
        const networkId = chain.testnet ? "testnet" : "mainnet";
        const cachedNear = this._nearInstance[networkId];
        if (cachedNear) return cachedNear;

        const nw = new NearW();
        const near = await nw.init({
            networkId,
            account: {
                privateKey:
                    options.nearPrivateKey,
                accountId: options.nearAccount,
            },
        });
        this._nearInstance[networkId] = near;
        return near;
    }

    private nearEthereumMap: Record<string, NearEthereum> = {};

    async start(options: StartOptions) {
      this._nearGraphqlEndpoint = XAPIConfig.graphql.endpoint(options.testnet ? "near-testnet" : "near");

        const publisherCache = new PublisherStorage(`${homedir}/.xapi-publisher/`);
        while (true) {
            let allAggregators: Aggregator[] = [];
            try {
                allAggregators = await this.nearGraphqlService.queryAllAggregators({
                    endpoint: this._nearGraphqlEndpoint!,
                });
            } catch (e) {
                // @ts-ignore
                logger.error(`==== Fetch aggregators failed: ${e.message}`, {
                    target: "main",
                });
            }
            if (!allAggregators || allAggregators.length == 0) {
                logger.info(`==== No aggregators, wait 60 seconds to continue ====`, {
                    target: "main",
                });
                await setTimeout(60000);
                continue;
            }
            for (const aggregator of allAggregators) {
                for (const chainId of aggregator.supported_chains) {
                    const chain = HelixChain.get(chainId);
                    if (!chain) {
                        logger.info("------------------------------------------------");
                        logger.error(`Can't find chain: ${chainId}`, {
                            target: "start"
                        });
                        continue;
                    }
                    const near = await this.near(options, chain);
                    const nearEthereum = this.getNearEthClient(chain);

                    try {
                        logger.info("------------------------------------------------");
                        logger.info(`==== 📞 start config-syncer for ${aggregator.id} [${chain.name}-${chain.id.toString()}] ====`, {
                            target: "config-syncer",
                        });
                        await this.runConfigSyncer({ ...options, near, targetChain: chain, nearEthereum, aggregator: aggregator.id, cache: publisherCache });
                        await setTimeout(1000);
                    } catch (e: any) {
                        logger.error(`run config-syncer errored: ${e.stack || e}`, {
                            target: "config-syncer",
                        });
                    }

                    try {
                        logger.info("------------------------------------------------");
                        logger.info(`==== 📦 start publisher for ${aggregator.id} [${chain.name}-${chain.id.toString()}] ====`, {
                            target: "publisher",
                        });
                        await this.runPublisher({ ...options, near, targetChain: chain, nearEthereum, aggregator: aggregator.id, cache: publisherCache });
                        await setTimeout(1000);
                    } catch (e: any) {
                        logger.error(`run publisher errored: ${e.stack || e}`, {
                            target: "publisher",
                        });
                    }

                    await setTimeout(1000);
                }
            }
        }
    }

    async runPublisher(lifecycle: PublisherLifecycle) {
        const { near, targetChain } = lifecycle;
        // 1. Fetch !fulfilled reqeust ids
        const nonfulfilled = await this.evmGraphqlService.queryTodoRequestMade({
            endpoint: XAPIConfig.graphql.endpoint(targetChain.code),
            aggregator: lifecycle.aggregator
        });
        // 2. Fetch aggregated events for nonfulfilled requests
        const aggregatedEvents =
            await this.nearGraphqlService.queryAggregatedeEvents({
                endpoint: this._nearGraphqlEndpoint!,
                ids: nonfulfilled.map((item) => item.requestId),
            });
        const toPublishIds = aggregatedEvents.map(a => a.request_id);
        logger.info(`==> ${lifecycle.aggregator} [${targetChain.name}-${targetChain.id.toString()}] toPublishIds: [${toPublishIds.length}], ${toPublishIds}`, {
            target: "publisher",
        });
        // 3. Check request status on xapi contract
        for (const aggregated of aggregatedEvents) {
            const relatedRequest = nonfulfilled.find(v => v.requestId == aggregated.request_id);

            const checkCache = await lifecycle.cache.get(this.publishCacheKey(lifecycle.aggregator, relatedRequest!.requestId));
            if (checkCache) {
                logger.warn(`==> ${lifecycle.aggregator} [${targetChain.name}-${targetChain.id.toString()}] skip cached request: ${relatedRequest!.requestId}, ${checkCache}`, {
                    target: "publisher",
                });
                continue;
            }

            const _request = await lifecycle.nearEthereum.getContractViewFunction(relatedRequest!.xapiAddress, xapiAbi, "requests", [relatedRequest!.requestId]);
            logger.info(`==> ${lifecycle.aggregator} [${targetChain.name}-${targetChain.id.toString()}] double check ${relatedRequest?.requestId}, status: ${_request.status}`, {
                target: "publisher",
            });
            if (_request.status == 0) {
                // 4. if status is pending, triggerPublish
                logger.info(`==> ${lifecycle.aggregator} [${relatedRequest?.requestId}] triggerPublish`, {
                    target: "publisher"
                })
                await this.triggerPublish(aggregated, relatedRequest!, lifecycle);
                await setTimeout(3000);
            }
        }
    }

    async runConfigSyncer(lifecycle: PublisherLifecycle) {
        const { near, targetChain } = lifecycle;

        // 1. Fetch latest SetPublishChainConfigEvent from near indexer for chainid
        const latestConfigFromNear =
            await this.nearGraphqlService.queryLatestPublishConfig({
                endpoint: this._nearGraphqlEndpoint!,
                chainId: lifecycle.targetChain.id.toString(),
                aggregator: lifecycle.aggregator
            });
        if (!latestConfigFromNear) {
            logger.warn(`==> [${targetChain.name}-${targetChain.id.toString()}] No publish config for ${lifecycle.aggregator}`, {
                target: "config-syncer",
            });
            return;
        }
        // 2. Fetch AggregatorConfigSet event from evm indexer
        const latestConfigFromEvm = await this.evmGraphqlService.queryAggregatorConfig({
            endpoint: XAPIConfig.graphql.endpoint(targetChain.code),
            aggregator: lifecycle.aggregator,
            version: latestConfigFromNear.version
        });
        if (latestConfigFromEvm && latestConfigFromEvm.version >= latestConfigFromNear.version) {
            logger.info(`==> [${targetChain.name}-${targetChain.id.toString()}] ${lifecycle.aggregator}, near: ${latestConfigFromNear.version} <= evm: ${latestConfigFromEvm?.version}`, {
                target: "config-syncer",
            });
            // No synchronization required
            return;
        }
        // 3. Double check chain config state on xapi contract
        const exAggregator = await this.deriveXAPIAddress(lifecycle.aggregator, lifecycle);
        const aggregatorConfigEvm = await lifecycle.nearEthereum.getContractViewFunction(latestConfigFromNear.xapi_address, xapiAbi, "aggregatorConfigs", [exAggregator]);
        if (aggregatorConfigEvm.version >= latestConfigFromNear.version) {
            return;
        }
        logger.info(`==> [${targetChain.name}-${targetChain.id.toString()}] ${lifecycle.aggregator}, near: ${latestConfigFromNear.version} > evm: ${latestConfigFromEvm?.version}`, {
            target: "config-syncer",
        });

        const checkCache = await lifecycle.cache.get(this.syncConfigCacheKey(lifecycle.aggregator, lifecycle.targetChain.id, latestConfigFromNear.version));
        if (checkCache) {
            logger.warn(`==> ${lifecycle.aggregator} [${targetChain.name}-${targetChain.id.toString()}] skip cached config version: ${latestConfigFromNear.version}, ${checkCache}`, {
                target: "config-syncer",
            });
            return;
        }

        // Then, need to trigger sync
        await this.triggerSyncConfig(latestConfigFromNear, lifecycle);
        await setTimeout(3000);
    }

    async triggerPublish(aggregated: XAPIResponse, relatedRequest: RequestMade, lifecycle: PublisherLifecycle) {
        // Derive address
        const deriveAddress = await this.deriveXAPIAddress(aggregated.aggregator!, lifecycle);
        logger.info(`===> deriveAddress: ${deriveAddress}`, {
            target: "do-publish",
        });
        // console.log("estimate", relatedRequest.xapiAddress, relatedRequest.requestId, aggregated.valid_reporters, aggregated.result)
        let gasLimit = 500_000n;
        try {
            gasLimit = await lifecycle.nearEthereum.estimateGas(relatedRequest.xapiAddress, xapiAbi, "fulfill",
                [relatedRequest.requestId, [aggregated.reporter_reward_addresses, lifecycle.nearEthereum.stringToBytes(aggregated.result), aggregated.error_code]],
                deriveAddress
            );
        } catch (e) {
            // @ts-ignore
            logger.error(`===> estimate gasLimit error: ${JSON.stringify(e.cause)}, ${e.reason}, ${e.message}`, {
                target: "do-publish",
            });
            // console.log("triggerPublish, estimate gas error", e);
        }

        logger.info(`===> gasLimit: ${gasLimit}`, {
            target: "do-publish",
        });
        const nonce = await lifecycle.nearEthereum.getNonce(deriveAddress);
        logger.info(`===> nonce: ${nonce}`, {
            target: "do-publish",
        });
        const balance = await lifecycle.nearEthereum.getBalance(deriveAddress);
        logger.info(`===> balance: ${balance}`, {
            target: "do-publish",
        });
        let { maxFeePerGas, maxPriorityFeePerGas } = await lifecycle.nearEthereum.queryGasPrice();
        maxFeePerGas = (BigInt(maxFeePerGas) * BigInt(3) / BigInt(2)).toString();
        maxPriorityFeePerGas = (BigInt(maxPriorityFeePerGas) * BigInt(3) / BigInt(2)).toString();
        logger.info(`===> maxFeePerGas: ${maxFeePerGas}, maxPriorityFeePerGas: ${maxPriorityFeePerGas}`, {
            target: "do-publish",
        });
        // call Aggregator publish_external()
        // @ts-ignore
        // const mpcConfig = await lifecycle.near.contractAggregator(aggregated.aggregator!).get_mpc_config();
        // logger.info(`===> mpcConfig: ${JSON.stringify(mpcConfig)}`, {
        //     target: "do-publish",
        // });

        let result;
        try {
            // @ts-ignore
            result = await lifecycle.near.contractAggregator(aggregated.aggregator!).publish_external(
                {
                    signerAccount: new NearAccount(lifecycle.near.near.connection, lifecycle.nearAccount),
                    args: {
                        request_id: aggregated.request_id,
                        mpc_options: { nonce: nonce.toString(), gas_limit: gasLimit.toString(), max_fee_per_gas: maxFeePerGas.toString(), max_priority_fee_per_gas: maxPriorityFeePerGas.toString() }
                    },
                    gas: "300000000000000",
                    amount: 0
                }
            );
        } catch (e) {
            // @ts-ignore
            logger.error(`===> publish_external error, try get result from indexer: ${e.message}`, {
                target: "do-publish",
            });
            // @ts-ignore
            if (e.message.includes("Exceeded the prepaid gas")) {
                await lifecycle.cache.put(this.publishCacheKey(lifecycle.aggregator, relatedRequest.requestId), `Exceeded the prepaid gas.`);
            } else {
                await setTimeout(5000);
                result =
                    await this.nearGraphqlService.queryPublishSignature({
                        endpoint: this._nearGraphqlEndpoint!,
                        requestId: relatedRequest.requestId,
                        aggregator: lifecycle.aggregator
                    });
            }
        }
        // console.log("publish_external result", result);
        if (result && result.signature) {
            let _signature = result.signature;
            if (typeof _signature == 'string') {
                // @ts-ignore
                _signature = JSON.parse(result.signature);
            }
            try {
                await this.relayMpcTx(result.response.chain_id, Address.fromString(result.publish_chain_config.xapi_address), result.call_data, {
                    id: "0",
                    // @ts-ignore
                    big_r_affine_point: _signature.big_r_affine_point || _signature.big_r.affine_point,
                    // @ts-ignore
                    s_scalar: _signature.s_scalar || _signature.s.scalar,
                    recovery_id: _signature.recovery_id
                }, result.mpc_options, lifecycle);
            } catch (e) {
                // @ts-ignore
                logger.error(`===> relayMpcTx error: ${JSON.stringify(e.cause)}, ${e.reason}`, {
                    target: "do-publish",
                });
            }
        } else {
            logger.error(`===> publish_external error: can't find result from indexer, aggregator: ${lifecycle.aggregator}, request_id: ${relatedRequest.requestId}`, {
                target: "do-publish",
            });
        }
    }

    publishCacheKey(aggregator: string, requestId: string): string {
        return `publish-${aggregator}-${requestId}`
    }

    async triggerSyncConfig(publishChainConfig: PublishChainConfig, lifecycle: PublisherLifecycle) {
        // Derive address
        const deriveAddress = await this.deriveXAPIAddress(publishChainConfig.aggregator!, lifecycle);
        logger.info(`===> deriveAddress: ${deriveAddress}`, {
            target: "do-sync-config",
        });
        let gasLimit = 500_000n;
        try {
            gasLimit = await lifecycle.nearEthereum.estimateGas(publishChainConfig.xapi_address, xapiAbi, "setAggregatorConfig",
                [publishChainConfig.aggregator, publishChainConfig.reporters_fee, publishChainConfig.publish_fee, publishChainConfig.reward_address, publishChainConfig.version],
                deriveAddress
            );
        } catch (e) {
            // @ts-ignore
            logger.error(`===> estimate gasLimit error: ${JSON.stringify(e.cause)}, ${e.reason}, ${e.message}`, {
                target: "do-sync-config",
            });
        }

        logger.info(`===> gasLimit: ${gasLimit}`, {
            target: "do-sync-config",
        });
        const nonce = await lifecycle.nearEthereum.getNonce(deriveAddress);
        logger.info(`===> nonce: ${nonce}`, {
            target: "do-sync-config",
        });
        const balance = await lifecycle.nearEthereum.getBalance(deriveAddress);
        logger.info(`===> balance: ${balance}`, {
            target: "do-sync-config",
        });
        let { maxFeePerGas, maxPriorityFeePerGas } = await lifecycle.nearEthereum.queryGasPrice();
        maxFeePerGas = (BigInt(maxFeePerGas) * BigInt(3) / BigInt(2)).toString();
        maxPriorityFeePerGas = (BigInt(maxPriorityFeePerGas) * BigInt(3) / BigInt(2)).toString();
        logger.info(`===> maxFeePerGas: ${maxFeePerGas}, maxPriorityFeePerGas: ${maxPriorityFeePerGas}`, {
            target: "do-sync-config",
        });
        // call Aggregator sync_publish_config_to_remote()
        // @ts-ignore
        // const mpcConfig = await lifecycle.near.contractAggregator(publishChainConfig.aggregator!).get_mpc_config();
        // logger.info(`===> mpcConfig: ${JSON.stringify(mpcConfig)}`, {
        //     target: "do-sync-config",
        // });

        let result;
        try {
            // @ts-ignore
            result = await lifecycle.near.contractAggregator(publishChainConfig.aggregator!).sync_publish_config_to_remote(
                {
                    signerAccount: new NearAccount(lifecycle.near.near.connection, lifecycle.nearAccount),
                    args: {
                        chain_id: publishChainConfig.chain_id,
                        mpc_options: { nonce: nonce.toString(), gas_limit: gasLimit.toString(), max_fee_per_gas: maxFeePerGas.toString(), max_priority_fee_per_gas: maxPriorityFeePerGas.toString() }
                    },
                    gas: "300000000000000",
                    amount: 0
                }
            );
        } catch (e) {
            // @ts-ignore
            logger.error(`===> sync_publish_config_to_remote error, try get result from indexer: ${e.message}`, {
                target: "do-sync-config",
            });
            // @ts-ignore
            if (e.message.includes("Exceeded the prepaid gas")) {
                await lifecycle.cache.put(this.syncConfigCacheKey(lifecycle.aggregator, lifecycle.targetChain.id, publishChainConfig.version), `Exceeded the prepaid gas.`);
            } else {
                await setTimeout(5000);
                result =
                    await this.nearGraphqlService.querySyncConfigSignature({
                        endpoint: this._nearGraphqlEndpoint!,
                        chainId: lifecycle.targetChain.id.toString(),
                        version: publishChainConfig.version,
                        aggregator: lifecycle.aggregator
                    });
            }
        }
        // console.log("sync_publish_config_to_remote result", result);
        if (result && result.signature) {
            let _signature = result.signature;
            if (typeof _signature == 'string') {
                // @ts-ignore
                _signature = JSON.parse(result.signature);
            }
            try {
                // @ts-ignore
                await this.relayMpcTx(result.chain_id, result.xapi_address, result.call_data, {
                    id: "0",
                    // @ts-ignore
                    big_r_affine_point: _signature.big_r_affine_point || _signature.big_r.affine_point,
                    // @ts-ignore
                    s_scalar: _signature.s_scalar || _signature.s.scalar,
                    recovery_id: _signature.recovery_id
                }, result.mpc_options, lifecycle);
            } catch (e) {
                // @ts-ignore
                logger.error(`===> relayMpcTx error: ${JSON.stringify(e.cause)}, ${e.reason}`, {
                    target: "do-sync-config",
                });
            }
        } else {
            logger.error(`===> sync_publish_config_to_remote error: can't find result from indexer, aggregator: ${lifecycle.aggregator}, chain_id: ${lifecycle.targetChain.id.toString()}, version: ${publishChainConfig.version}`, {
                target: "do-sync-config",
            });
        }
    }

    syncConfigCacheKey(aggregator: string, chainId: bigint, version: string): string {
        return `syncconfig-${aggregator}-${chainId}-${version}`;
    }

    async relayMpcTx(chainId: string, contract: Address, calldata: string, signature: Signature, mpcOptions: MpcOptions, lifecycle: PublisherLifecycle) {
        const transaction = FeeMarketEIP1559Transaction.fromTxData({
            nonce: BigInt(mpcOptions.nonce),
            gasLimit: BigInt(mpcOptions.gas_limit),
            maxFeePerGas: BigInt(mpcOptions.max_fee_per_gas),
            maxPriorityFeePerGas: BigInt(mpcOptions.max_priority_fee_per_gas),
            to: contract,
            data: calldata as any,
            value: 0,
        }, { common: new Common({ chain: BigInt(chainId) }) })

        // console.log("### transaction", transaction);

        const signedTransaction = await lifecycle.nearEthereum.reconstructSignature({ affine_point: signature.big_r_affine_point }, { scalar: signature.s_scalar }, signature.recovery_id, transaction);
        // console.log("### signedTransaction", signedTransaction);

        const txHash = await lifecycle.nearEthereum.relayTransaction(signedTransaction);
        logger.info(`===> [${lifecycle.targetChain.name}-${lifecycle.targetChain.id}] tx: ${txHash} `, {
            target: " 🚀 ",
        });
    }

    async deriveXAPIAddress(aggregator: string, lifecycle: PublisherLifecycle) {
        return (await lifecycle.nearEthereum.deriveAddress(aggregator, `XAPI-${lifecycle.targetChain.id.toString()}`)).address;
    }

    getNearEthClient(chain: HelixChainConf): NearEthereum {
        const cachedNearEthereum = this.nearEthereumMap[chain.id.toString()];
        if (cachedNearEthereum) {
            return cachedNearEthereum;
        }
        const ne = new NearEthereum(chain.rpc, chain.id.toString());
        this.nearEthereumMap[chain.id.toString()] = ne;
        return ne;
    }

    bigIntMin(args: any[]) {
        return args.reduce((m, e) => e < m ? e : m);
    }
}
