import {
  AggregatorConfigSet as AggregatorConfigSetEvent,
  AggregatorSuspended as AggregatorSuspendedEvent,
  Fulfilled as FulfilledEvent,
  OwnershipTransferStarted as OwnershipTransferStartedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  RequestMade as RequestMadeEvent,
  RewardsWithdrawn as RewardsWithdrawnEvent
} from "../generated/XAPI/XAPI"
import {
  AggregatorConfigSet,
  AggregatorSuspended,
  Fulfilled,
  OwnershipTransferStarted,
  OwnershipTransferred,
  RequestMade,
  RewardsWithdrawn
} from "../generated/schema"

export function handleAggregatorConfigSet(
  event: AggregatorConfigSetEvent
): void {
  let entity = new AggregatorConfigSet(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString().toLowerCase()
  )
  entity.exAggregator = event.params.exAggregator.toHexString().toLowerCase()
  entity.reportersFee = event.params.reportersFee
  entity.publishFee = event.params.publishFee
  entity.aggregator = event.params.aggregator
  entity.rewardAddress = event.params.rewardAddress.toHexString().toLowerCase()

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash.toHexString().toLowerCase()

  entity.save()
}

export function handleAggregatorSuspended(
  event: AggregatorSuspendedEvent
): void {
  let entity = new AggregatorSuspended(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString().toLowerCase()
  )
  entity.exAggregator = event.params.exAggregator.toHexString().toLowerCase()
  entity.aggregator = event.params.aggregator.toHexString().toLowerCase()

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash.toHexString().toLowerCase()

  entity.save()
}

export function handleFulfilled(event: FulfilledEvent): void {
  let entity = new Fulfilled(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString().toLowerCase()
  )
  const reporters: string[] = [];
  const responseReporters = event.params.response.reporters;
  for (let i=0; i<responseReporters.length; i++) {
    reporters.push(responseReporters[i].toHexString().toLowerCase());
  }

  entity.requestId = event.params.requestId
  entity.response_reporters = reporters
  entity.response_result = event.params.response.result.toHexString().toLowerCase()
  entity.response_errorCode = event.params.response.errorCode
  entity.status = event.params.status

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferStarted(
  event: OwnershipTransferStartedEvent
): void {
  let entity = new OwnershipTransferStarted(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleRequestMade(event: RequestMadeEvent): void {
  let entity = new RequestMade(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.requestId = event.params.requestId
  entity.aggregator = event.params.aggregator
  entity.requestData = event.params.requestData
  entity.requester = event.params.requester
  entity.exAggregator = event.params.exAggregator
  entity.reportersFee = event.params.reportersFee
  entity.publishFee = event.params.publishFee

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleRewardsWithdrawn(event: RewardsWithdrawnEvent): void {
  let entity = new RewardsWithdrawn(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.withdrawer = event.params.withdrawer
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
