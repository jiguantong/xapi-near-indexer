

export interface ReporterRequired {
  quorum: number
  threshold: number
}

export interface RequestMade {
  id: string
  requestId: string
  aggregator: string
  requestData: string
  requester: string
  blockNumber: string
  blockTimestamp: string
  transactionHash: string
  fulfilled: number
}

export interface XAPIResponse {
  valid_reporters: string[]
  updated_at: string
  status: string
  started_at: string
  result: string
  request_id: string
  id: string
  chain_id: string
  reporter_reward_addresses: string[]
}
