#!/bin/bash
# Runs a k6 scenario through Docker Compose, from the lab's root directory.
# Usage: scripts/run-k6.sh [/k6/scenarios/<file>.js]
set -e
cd "$(dirname "$0")/.."

TEST_SCRIPT=${1:-/k6/scenarios/toy-fast.js}

docker compose run --rm k6 run "$TEST_SCRIPT"
