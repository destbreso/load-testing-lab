#!/bin/bash
set -e

# Load variables from .env
if [ -f ../.env ]; then
  export $(grep -v '^#' ../.env | xargs)
fi


echo "Resetting InfluxDB metrics..."
curl -X POST "${INFLUXDB_URL}/api/v2/delete?org=${INFLUXDB_ORG}&bucket=${INFLUXDB_BUCKET}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
        "start": "1970-01-01T00:00:00Z",
        "stop": "2100-01-01T00:00:00Z",
        "predicate": "true"
      }'

echo "Metrics reset complete."
