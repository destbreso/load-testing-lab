#!/bin/bash
# Runs an Artillery scenario through Docker Compose, from the lab's root directory.
# Usage: scripts/run-artillery.sh [/artillery/scenarios/<file>.yml]
set -e
cd "$(dirname "$0")/.."

TEST_SCRIPT=${1:-/artillery/scenarios/toy-fast.yml}

docker compose run --rm artillery run "$TEST_SCRIPT"
