#!/bin/bash
# Deletes every stored metric from the lab's InfluxDB (same as `ltlab reset`,
# without the confirmation prompt).
set -e
exec node "$(dirname "$0")/reset-metrics.js"
