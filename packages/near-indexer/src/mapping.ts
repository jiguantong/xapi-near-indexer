import { BigInt, log, near, json, TypedMap, JSONValue, JSONValueKind } from '@graphprotocol/graph-ts';
import { Response, PublishChainConfig, PublishEvent, Signature, AggregatedEvent, SetPublishChainConfigEvent, MpcOptions, SyncPublishChainConfigEvent } from '../generated/schema';

export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;
  for (let i = 0; i < actions.length; i++) {
    handleAction(actions[i], receipt.receipt, receipt.outcome.logs, receipt.block.header);
  }
}

function handleAction(
  action: near.ActionValue,
  receipt: near.ActionReceipt,
  logs: string[],
  blockHeader: near.BlockHeader,
): void {
  if (action.kind != near.ActionKind.FUNCTION_CALL) {
    return;
  }

  const functionCall = action.toFunctionCall();
  log.info("functionCall: {}, {}, {}", [functionCall.methodName, functionCall.args.toString(), logs.toString()]);

  if (functionCall.methodName == "publish_callback") {
    handlePublish(logs, blockHeader);
  } else if (functionCall.methodName == "post_aggregate_callback") {
    handleAggregated(logs, blockHeader);
  } else if (functionCall.methodName == "set_publish_chain_config") {
    handleSetPublishChainConfig(logs, blockHeader);
  } else if (functionCall.methodName == "sync_publish_config_to_remote") {
    handleSyncPublishChainConfig(logs, blockHeader);
  }
}

function handlePublish(logs: string[], blockHeader: near.BlockHeader): void {
  const _event = extractEvent("Publish", logs);
  if (!_event) {
    return;
  }

  const nanoId = `${blockHeader.timestampNanosec}`;
  const _eventData = _event.mustGet("data").toObject();
  const request_id = _eventData.mustGet("request_id").toString();
  const _responseData = _eventData.mustGet("response").toObject();

  let response = Response.load(nanoId);
  if (response == null) {
    response = parseResponse(_responseData, nanoId);
    response.save();
  }

  const _chainConfigData = _eventData.mustGet("chain_config").toObject()
  let chainConfig = PublishChainConfig.load(_chainConfigData.mustGet("version").toString());
  if (chainConfig == null) {
    chainConfig = parseChainConfig(_chainConfigData);
    chainConfig.save();
  }

  let signature = Signature.load(nanoId);
  if (signature == null) {
    signature = parseSignature(_eventData, nanoId);
    signature.save();
  }

  const _mpcOptionsData = _eventData.mustGet("mpc_options").toObject();
  let mpcOptions = MpcOptions.load(nanoId);
  if (mpcOptions == null) {
    mpcOptions = parseMpcOptions(_mpcOptionsData, nanoId);
    mpcOptions.save();
  }

  let publishEvent = PublishEvent.load(nanoId);
  if (publishEvent == null) {
    publishEvent = new PublishEvent(`${nanoId}`);
    publishEvent.request_id = request_id;
    publishEvent.response = nanoId;
    publishEvent.publish_chain_config = nanoId;
    publishEvent.signature = nanoId;
    publishEvent.mpc_options = nanoId;
    publishEvent.call_data = _eventData.mustGet("call_data").toString();
    publishEvent.save();
  } else {
    log.debug("Publish event already exists: {}", [request_id]);
  }
}

function handleAggregated(logs: string[], blockHeader: near.BlockHeader): void {
  const _event = extractEvent("Aggregated", logs);
  if (!_event) {
    return;
  }
  const nanoId = `${blockHeader.timestampNanosec}`;
  const _eventData = _event.mustGet("data").toObject();
  const request_id = _eventData.mustGet("request_id").toString();

  let response = Response.load(nanoId);
  if (response == null) {
    response = parseResponse(_eventData, nanoId);
    response.save();
  }

  let aggregatedEvent = AggregatedEvent.load(request_id);
  if (aggregatedEvent == null) {
    aggregatedEvent = new AggregatedEvent(request_id);
    aggregatedEvent.request_id = request_id;
    aggregatedEvent.response = nanoId;
    aggregatedEvent.save();
  } else {
    log.debug("Aggregated event already exists: {}", [request_id]);
  }
}

function handleSetPublishChainConfig(logs: string[], blockHeader: near.BlockHeader): void {
  const _event = extractEvent("SetPublishChainConfig", logs);
  if (!_event) {
    return;
  }
  const nanoId = `${blockHeader.timestampNanosec}`;
  const _eventData = _event.mustGet("data").toObject();

  const _chainConfigData = _eventData.mustGet("chain_config").toObject()
  let chainConfig = PublishChainConfig.load(_chainConfigData.mustGet("version").toString());
  if (chainConfig == null) {
    chainConfig = parseChainConfig(_chainConfigData);
    chainConfig.save();
  }

  let setPublishChainConfigEvent = SetPublishChainConfigEvent.load(nanoId);
  if (setPublishChainConfigEvent == null) {
    setPublishChainConfigEvent = new SetPublishChainConfigEvent(nanoId);
    setPublishChainConfigEvent.publish_chain_config = nanoId;
    setPublishChainConfigEvent.save();
  } else {
    log.debug("SetPublishChainConfigEvent event already exists: {}", [nanoId]);
  }
}

function handleSyncPublishChainConfig(logs: string[], blockHeader: near.BlockHeader): void {
  const _event = extractEvent("SyncPublishChainConfig", logs);
  if (!_event) {
    return;
  }

  const nanoId = `${blockHeader.timestampNanosec}`;
  const _eventData = _event.mustGet("data").toObject();

  const _version = _eventData.mustGet("version").toString();
  let publishChainConfig = PublishChainConfig.load(_version);
  if (publishChainConfig == null) {
    log.error("Can't handleSyncPublishChainConfig, PublishChainConfig does not exist, version: {}", [_version]);
    return;
  }

  let signature = Signature.load(nanoId);
  if (signature == null) {
    signature = parseSignature(_eventData, nanoId);
    signature.save();
  }

  const _mpcOptionsData = _eventData.mustGet("mpc_options").toObject();
  let mpcOptions = MpcOptions.load(nanoId);
  if (mpcOptions == null) {
    mpcOptions = parseMpcOptions(_mpcOptionsData, nanoId);
    mpcOptions.save();
  }

  let syncPublishChainConfigEvent = SyncPublishChainConfigEvent.load(nanoId);
  if (syncPublishChainConfigEvent == null) {
    syncPublishChainConfigEvent = new SyncPublishChainConfigEvent(`${nanoId}`);
    syncPublishChainConfigEvent.publish_chain_config = _version;
    syncPublishChainConfigEvent.chain_id = BigInt.fromString(_eventData.mustGet("chain_id").toString());
    syncPublishChainConfigEvent.xapi_address = _eventData.mustGet("xapi_address").toString();
    syncPublishChainConfigEvent.version = BigInt.fromString(_eventData.mustGet("xapi_address").toString());
    syncPublishChainConfigEvent.call_data = _eventData.mustGet("call_data").toString();
    syncPublishChainConfigEvent.signature = nanoId;
    syncPublishChainConfigEvent.mpc_options = nanoId;
    syncPublishChainConfigEvent.save();
  } else {
    log.debug("SyncPublishChainConfig event already exists: {}", [nanoId]);
  }
}

function extractEvent(event: string, logs: string[]): TypedMap<string, JSONValue> | null {
  for (let i = 0; i < logs.length; i++) {
    let _log = logs[i];
    if (_log.includes("EVENT_JSON")) {
      _log = _log.replace("EVENT_JSON: ", "");
      log.debug("==> ### EVENT log : {}", [_log]);
      const jsonValue = json.fromString(_log);
      if (jsonValue.kind == JSONValueKind.OBJECT) {
        const _eventJson = jsonValue.toObject();
        log.debug("Log is a valid JSON object: {}", [_log]);
        const _eventName = jsonValue.toObject().mustGet("event").toString();
        if (_eventJson && _eventName == event) {
          log.debug("===> ### Catch event: {}", [_eventName])
          return _eventJson;
        }
      } else {
        log.error("Log is not a valid JSON object: {}", [_log, jsonValue.toString()]);
      }
    }
  }

  return null;
}

function parseResponse(eventData: TypedMap<string, JSONValue>, nanoId: string): Response {
  log.debug("!!!### parseResponse", []);
  const response = new Response(nanoId);
  response.request_id = eventData.mustGet("request_id").toString();
  response.valid_reporters = eventData.mustGet("valid_reporters").toArray().map<string>((v: JSONValue) => { return v.toString() });
  response.reporter_reward_addresses = eventData.mustGet("reporter_reward_addresses").toArray().map<string>((v: JSONValue) => { return v.toString() });
  response.started_at = BigInt.fromString(eventData.mustGet("started_at").toString());
  response.updated_at = BigInt.fromString(eventData.mustGet("updated_at").toString());
  response.status = eventData.mustGet("status").toString();
  response.result = eventData.mustGet("result").toString();
  response.chain_id = BigInt.fromString(eventData.mustGet("chain_id").toString());
  return response;
}

function parseChainConfig(chainConfigJson: TypedMap<string, JSONValue>): PublishChainConfig {
  log.debug("!!!### parseChainConfig", []);
  const chainConfig = new PublishChainConfig(chainConfigJson.mustGet("version").toString());
  chainConfig.chain_id = BigInt.fromString(chainConfigJson.mustGet("chain_id").toString());
  chainConfig.xapi_address = chainConfigJson.mustGet("xapi_address").toString();
  chainConfig.reporters_fee = BigInt.fromString(chainConfigJson.mustGet("reporters_fee").toString());
  chainConfig.publish_fee = BigInt.fromString(chainConfigJson.mustGet("publish_fee").toString());
  chainConfig.reward_address = chainConfigJson.mustGet("reward_address").toString();
  chainConfig.version = BigInt.fromString(chainConfigJson.mustGet("version").toString());
  return chainConfig;
}

function parseSignature(eventData: TypedMap<string, JSONValue>, nanoId: string): Signature {
  log.debug("!!!### parseSignature", []);
  const signatureJson = json.fromString(eventData.mustGet("signature").toString()).toObject();
  const signature = new Signature(nanoId);
  signature.big_r_affine_point = signatureJson.mustGet("big_r").toObject().mustGet("affine_point").toString();
  signature.recovery_id = signatureJson.mustGet("recovery_id").toI64() as i32;
  signature.s_scalar = signatureJson.mustGet("s").toObject().mustGet("scalar").toString();
  return signature;
}

function parseMpcOptions(mpcOptionsJson: TypedMap<string, JSONValue>, nanoId: string): MpcOptions {
  log.debug("!!!### parseMpcOptions", []);
  const mpcOptions = new MpcOptions(nanoId);
  mpcOptions.nonce = BigInt.fromString(mpcOptionsJson.mustGet("nonce").toString());
  mpcOptions.gas_limit = BigInt.fromString(mpcOptionsJson.mustGet("gas_limit").toString());
  mpcOptions.max_fee_per_gas = BigInt.fromString(mpcOptionsJson.mustGet("max_fee_per_gas").toString());
  mpcOptions.max_priority_fee_per_gas = BigInt.fromString(mpcOptionsJson.mustGet("max_priority_fee_per_gas").toString());
  return mpcOptions;
}
