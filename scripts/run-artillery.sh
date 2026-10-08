#!/bin/bash
set -e

TEST_SCRIPT=${1:-/artillery/scenarios/toy-fast.yml}

docker-compose run --rm artillery npx artillery run $TEST_SCRIPT
