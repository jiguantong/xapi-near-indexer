export interface ReporterRequired {
  quorum: number;
  threshold: number;
}

export interface RequestMade {
  id: string;
  xapiAddress: string;
  transactionHash: string;
  requester: string;
  requestId: string;
  requestData: string;
  reportersFee: string;
  publishFee: string;
  aggregator: string;
  exAggregator: string;

  fulfilled: number;
  blockTimestamp: string;
  blockNumber: string;
}

export interface XAPIResponse {
  valid_reporters: string[];
  updated_at: string;
  status: string;
  started_at: string;
  result: string;
  request_id: string;
  id: string;
  chain_id: string;
  reporter_reward_addresses: string[];
  aggregator?: string;
  error_code: number;
}

export interface TopStaked {
  account_id: string;
  amount: string;
}

export type ResultPathString = `headers.${string}` | `body.${string}`;
export type AuthPlacePathString =
  | `headers.${string}`
  | `body.${string}`
  | `query.${string}`;
export type AuthValuePathString = `env.${string}`;
export interface Datasource {
  method: string;
  name: string;
  result_path?: ResultPathString;
  url: string;
  auth: DatasourceAuth;
  body_json?: any;
  query_json?: any;
  headers?: Record<string, any>;
}

export interface DatasourceAuth {
  place_path: AuthPlacePathString;
  value_path: AuthValuePathString;
}

export interface Signature {
  id: string;
  big_r_affine_point: string;
  recovery_id: number;
  s_scalar: string;
}

export interface PublishChainConfig {
  id: string;
  chain_id: string;
  xapi_address: string;
  reporters_fee: string;
  publish_fee: string;
  reward_address: string;
  version: string;
  aggregator?: string;
}

export interface PublishEvent {
  id: string;
  request_id: string;
  response: XAPIResponse;
  publish_chain_config: PublishChainConfig;
  signature: Signature;
  call_data: string;
  mpc_options: MpcOptions;
  aggregator: string;
}

export interface SyncPublishChainConfigEvent {
  id: string;
  chain_id: string;
  xapi_address: string;
  version: string;
  call_data: string;
  signature: Signature;
  mpc_options: MpcOptions;
  publish_chain_config: PublishChainConfig;
  aggregator: string;
}

export interface MpcOptions {
  id: string;
  nonce: string;
  gas_limit: string;
  max_fee_per_gas: string;
  max_priority_fee_per_gas: string;
}

export interface Report {
  request_id: string;
  reporter?: string;
  timestamp?: string;
  reward_address: string;
  answers: Answer[];
}

export interface Answer {
  data_source_name: string;
  result?: string;
  error?: string;
}

export interface Aggregator {
  id: string;
  supported_chains: string[];
}
