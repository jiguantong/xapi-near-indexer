#!/bin/bash
#

set -e

BIN_PATH=$(cd "$(dirname "$0")"; pwd -P)
WORK_PATH=${BIN_PATH}/../

cd ${WORK_PATH}

npm run build:offchain

cd ${WORK_PATH}/packages/publisher-client

export XAPI_LOG_LEVEL=info
export XAPI_REWRITE_CONSOLE=0

node dist/main.js $@
