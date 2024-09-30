#!/bin/bash
#

set -e

BIN_PATH=$(cd "$(dirname "$0")"; pwd -P)
WORK_PATH=${BIN_PATH}/../

cd ${WORK_PATH}/packages/reporter-client

npm run build
node dist/main.js $@
