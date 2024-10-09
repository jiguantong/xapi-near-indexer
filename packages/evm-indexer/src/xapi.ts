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
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.aggregator = event.params.aggregator
  entity.perReporterFee = event.params.perReporterFee
  entity.publishFee = event.params.publishFee
  entity.fulfillAddress = event.params.fulfillAddress
  entity.rewardAddress = event.params.rewardAddress

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleAggregatorSuspended(
  event: AggregatorSuspendedEvent
): void {
  let entity = new AggregatorSuspended(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.aggregator = event.params.aggregator

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleFulfilled(event: FulfilledEvent): void {
  let entity = new Fulfilled(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.requestId = event.params.requestId
  entity.response_reporters = event.params.response.reporters
  entity.response_result = event.params.response.result
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
