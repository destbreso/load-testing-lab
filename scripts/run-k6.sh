#!/bin/bash
set -e

TEST_SCRIPT=${1:-/k6/scenarios/toy-fast.js}

docker-compose run --rm k6 run $TEST_SCRIPT
