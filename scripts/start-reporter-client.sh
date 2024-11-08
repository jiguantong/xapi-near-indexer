#!/bin/bash
#

set -e

BIN_PATH=$(cd "$(dirname "$0")"; pwd -P)
WORK_PATH=${BIN_PATH}/../

cd ${WORK_PATH}

# npm run build:offchain

cd ${WORK_PATH}/packages/reporter-client

export XAPI_LOG_FULL=0
export XAPI_LOG_LEVEL=info
export XAPI_REWRITE_CONSOLE=1
export XAPI_UNSAFE_SHOW_REQUEST_INFO=0

node dist/main.js $@
