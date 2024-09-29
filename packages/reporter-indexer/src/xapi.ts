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
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHex()
  )
  entity.aggregator = event.params.aggregator.toHex()
  entity.perReporterFee = event.params.perReporterFee
  entity.publishFee = event.params.publishFee
  entity.fulfillAddress = event.params.fulfillAddress.toHex()
  entity.rewardAddress = event.params.rewardAddress.toHex()

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash.toHex()

  entity.save()
}

export function handleAggregatorSuspended(
  event: AggregatorSuspendedEvent
): void {
  let entity = new AggregatorSuspended(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHex()
  )
  entity.aggregator = event.params.aggregator.toHex()

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash.toHex()

  entity.save()
}

export function handleFulfilled(event: FulfilledEvent): void {
  let entity = new Fulfilled(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHex()
  )
  entity.requestId = event.params.requestId
  entity.response_reporters = event.params.response.reporters.map(reporter => reporter.toHex())
  entity.response_result = event.params.response.result.toHex()
  entity.status = event.params.status

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash.toHex()

  entity.save()
}

export function handleOwnershipTransferStarted(
  event: OwnershipTransferStartedEvent
): void {
  let entity = new OwnershipTransferStarted(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHex()
  )
  entity.previousOwner = event.params.previousOwner.toHex()
  entity.newOwner = event.params.newOwner.toHex()

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash.toHex()

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHex()
  )
  entity.previousOwner = event.params.previousOwner.toHex()
  entity.newOwner = event.params.newOwner.toHex()

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash.toHex()

  entity.save()
}

export function handleRequestMade(event: RequestMadeEvent): void {
  let entity = new RequestMade(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHex()
  )
  entity.requestId = event.params.requestId
  entity.aggregator = event.params.aggregator
  entity.requestData = event.params.requestData
  entity.requester = event.params.requester.toHex()
  entity.reporterRequired_quorum = event.params.reporterRequired.quorum
  entity.reporterRequired_threshold = event.params.reporterRequired.threshold

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash.toHex()

  entity.save()
}

export function handleRewardsWithdrawn(event: RewardsWithdrawnEvent): void {
  let entity = new RewardsWithdrawn(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHex()
  )
  entity.withdrawer = event.params.withdrawer.toHex()
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash.toHex()

  entity.save()
}
