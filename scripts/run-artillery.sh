#!/bin/bash
set -e

TEST_SCRIPT=${1:-/artillery/scenarios/inspection-flow.yml}

docker-compose run --rm artillery npx artillery run $TEST_SCRIPT
