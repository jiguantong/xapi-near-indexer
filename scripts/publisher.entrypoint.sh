#!/bin/sh
#

set -e

BIN_PATH=$(cd "$(dirname "$0")"; pwd -P)
WORK_PATH=${BIN_PATH}/../

node ${WORK_PATH}/packages/publisher-client/dist/main.js $@
