import axios from 'axios';
import { Service } from 'typedi';

export interface Response {
    id: string
    request_id: string
    valid_reporters: string[]
    reporter_reward_addresses: string[]
    started_at: string
    updated_at: string
    status: string
    result: string
    chain_id: string
}

export interface PublishChainConfig {
    id: string
    chain_id: string
    xapi_address: string
    reporters_fee: string
    publish_fee: string
    reward_address: string
    version: string
}

export interface Signature {
    id: string
    big_r_affine_point: string
    recovery_id: number
    s_scalar: string
}

export interface PublishEvent {
    id: string
    request_id: string
    response: Response
    publish_chain_config: PublishChainConfig
    signature: Signature
    call_data: string
    mpc_options: MpcOptions
}

export interface AggregatedEvent {
    id: string
    request_id: string
    valid_reporters: string[]
    reporter_reward_addresses: string[]
    started_at: string
    updated_at: string
    status: string
    result: string
    chain_id: string
}

export interface SyncPublishChainConfigEvent {
    id: String
    chain_id: String
    xapi_address: String
    version: String
    call_data: String
    signature: Signature
    mpc_options: MpcOptions
    publish_chain_config: PublishChainConfig
}

export interface MpcOptions {
    id: String
    nonce: string
    gas_limit: string
    max_fee_per_gas: string
    max_priority_fee_per_gas: string
}

abstract class AbstractGraphqlQuery {
    abstract queryPublishEvent(): Promise<PublishEvent[]>;
}

@Service()
export class GraphqlService extends AbstractGraphqlQuery {

    private readonly thegraph: ThegraphService = new ThegraphService();

    async queryPublishEvent(): Promise<PublishEvent[]> {
        return this.thegraph.queryPublishEvent();
    }
    async querySyncPublishChainConfigEvent(): Promise<SyncPublishChainConfigEvent[]> {
        return this.thegraph.querySyncPublishChainConfigEvent();
    }
}

class ThegraphService extends AbstractGraphqlQuery {
    async queryPublishEvent(): Promise<PublishEvent[]> {
        return [
            {
                "id": "1728902122732792483",
                "publish_chain_config": {
                    "chain_id": "11155111",
                    "id": "1728716392176893045",
                    "xapi_address": "0x6984ebE378F8cb815546Cb68a98807C1fA121A81",
                    "reporters_fee": "300",
                    "publish_fee": "400",
                    "version": "1728716392176893045",
                    "reward_address": "0x9F33a4809aA708d7a399fedBa514e0A0d15EfA85"
                },
                "request_id": "70021766616531051842153016788507494922593962344450640499185811461",
                "response": {
                    "chain_id": "11155111",
                    "id": "1728902122732792483",
                    "reporter_reward_addresses": [
                        "0x9F33a4809aA708d7a399fedBa514e0A0d15EfA85"
                    ],
                    "request_id": "70021766616531051842153016788507494922593962344450640499185811461",
                    "result": "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ",
                    "started_at": "1728898742999108912",
                    "status": "PUBLISHED",
                    "updated_at": "1728898744567108425",
                    "valid_reporters": [
                        "guantong.testnet"
                    ]
                },
                "signature": {
                    "big_r_affine_point": "0328FDB0D9AB139E297ED12CCF986F59ABA7FE62776202C2BAD4A4900BF5B4F33D",
                    "id": "1728902122732792483",
                    "recovery_id": 1,
                    "s_scalar": "1849A42E62D767819918AC397B7B86BEA1E140B64C7E65B7C228353E2895BD11"
                },
                "call_data": "0xb158e7660000000000aa36a700000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010000000000000000000000009f33a4809aa708d7a399fedba514e0a0d15efa8500000000000000000000000000000000000000000000000000000000000000855365642075742070657273706963696174697320756e6465206f6d6e69732069737465206e61747573206572726f722073697420766f6c7570746174656d206163637573616e7469756d20646f6c6f72656d717565206c617564616e7469756d2c20746f74616d2072656d206170657269616d2c2065617175652069707361207175616520000000000000000000000000000000000000000000000000000000",
                "mpc_options": {
                    "gas_limit": "2000000",
                    "id": "1728902122732792483",
                    "max_fee_per_gas": "305777608991",
                    "max_priority_fee_per_gas": "2500000000",
                    "nonce": "2"
                }
            }
        ];
    }

    async querySyncPublishChainConfigEvent(): Promise<SyncPublishChainConfigEvent[]> {
        return [
            {
                "call_data": "0xb83398890000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000012c00000000000000000000000000000000000000000000000000000000000001900000000000000000000000006984ebe378f8cb815546cb68a98807c1fa121a81000000000000000000000000000000000000000000000000000000000000001f6f726d7061676772656761746f722e6775616e746f6e672e746573746e657400",
                "chain_id": "11155111",
                "id": "1728901133005886162",
                "mpc_options": {
                    "gas_limit": "200000",
                    "id": "1728901133005886162",
                    "max_fee_per_gas": "305777608991",
                    "max_priority_fee_per_gas": "2500000000",
                    "nonce": "1"
                },
                "publish_chain_config": {
                    "chain_id": "11155111",
                    "id": "1728716392176893045",
                    "publish_fee": "400",
                    "reporters_fee": "300",
                    "reward_address": "0x9F33a4809aA708d7a399fedBa514e0A0d15EfA85",
                    "version": "1728716392176893045",
                    "xapi_address": "0x6984ebE378F8cb815546Cb68a98807C1fA121A81"
                },
                "signature": {
                    "big_r_affine_point": "0348EEA2B5DD4182D2ED209161CD0D35AD6CCAE7341A035AA6BCE05A30FC8A9FB8",
                    "id": "1728901133005886162",
                    "recovery_id": 1,
                    "s_scalar": "795AAEFB55CEBE88B91A65C0BCD38FCDEAA356EEFABA3B3E1D273F1131DA40D3"
                },
                "version": "1728716392176893045",
                "xapi_address": "0x6984ebE378F8cb815546Cb68a98807C1fA121A81"
            }
        ]
    }
}