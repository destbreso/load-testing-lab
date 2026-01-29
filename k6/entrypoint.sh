#!/bin/sh
set -e

# Build K6_OUT variable with environment variables
# The xk6-influxdb extension can also read environment variables directly
if [ -n "$INFLUXDB_BUCKET" ] && [ -n "$INFLUXDB_ORG" ] && [ -n "$INFLUXDB_TOKEN" ]; then
  # Configure environment variables that xk6-influxdb can read
  export K6_INFLUXDB_ORGANIZATION="$INFLUXDB_ORG"
  export K6_INFLUXDB_BUCKET="$INFLUXDB_BUCKET"
  export K6_INFLUXDB_TOKEN="$INFLUXDB_TOKEN"
  export K6_INFLUXDB_ADDR="http://influxdb:8086"
  export K6_INFLUXDB_INSECURE=true
  
  # Configure K6_OUT
  export K6_OUT="xk6-influxdb"
  
  echo "✅ K6 InfluxDB configured:"
  echo "   Organization: $INFLUXDB_ORG"
  echo "   Bucket: $INFLUXDB_BUCKET"
  echo "   Addr: http://influxdb:8086"
else
  echo "⚠️  WARNING: InfluxDB variables not configured, K6_OUT not available"
fi

# Execute k6 with provided arguments
exec /usr/bin/k6 "$@"
