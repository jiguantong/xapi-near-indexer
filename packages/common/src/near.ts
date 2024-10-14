

import { ContractMethods } from "near-api-js/lib/contract";

export interface NearContractOptions {
  contractId: string;
  options: ContractMethods;
}



export const StoredNearContractOptions: Record<string, NearContractOptions> = {
  ormpAggregator: {
    contractId: 'ormpaggregator.guantong.testnet',
    options: {
      viewMethods: ['get_response'],
      changeMethods: [],
      useLocalViewExecution: false,
    }
  },
  ormpStaking: {
    contractId: 'stake.guantong.testnet',
    options: {
      viewMethods: [],
      changeMethods: [],
      useLocalViewExecution: false,
    }
  },
};
