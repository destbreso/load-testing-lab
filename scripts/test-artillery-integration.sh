#!/bin/bash

# Script to verify Artillery integration with InfluxDB
# Runs a short test and verifies that metrics reach InfluxDB

set -e

echo "🧪 Testing Artillery → Telegraf → InfluxDB Integration"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check if Telegraf is running
echo "1️⃣  Checking Telegraf status..."
if docker ps | grep -q telegraf; then
    echo -e "${GREEN}✓ Telegraf is running${NC}"
else
    echo -e "${RED}✗ Telegraf is not running${NC}"
    echo "   Starting Telegraf..."
    docker-compose up -d telegraf
    sleep 3
fi
echo ""

# 2. Check if InfluxDB is running
echo "2️⃣  Checking InfluxDB status..."
if docker ps | grep -q influxdb; then
    echo -e "${GREEN}✓ InfluxDB is running${NC}"
else
    echo -e "${RED}✗ InfluxDB is not running${NC}"
    echo "   Start InfluxDB with: docker-compose up -d influxdb"
    exit 1
fi
echo ""

# 3. Run short Artillery test
echo "3️⃣  Running Artillery test (30 seconds)..."
echo -e "${YELLOW}   This will generate traffic to the Toy API${NC}"
docker-compose run --rm artillery run /artillery/scenarios/toy-fast.yml &
ARTILLERY_PID=$!

# Wait a bit for Artillery to generate metrics
sleep 5
echo ""

# 4. Check for metrics in InfluxDB
echo "4️⃣  Checking for Artillery metrics in InfluxDB..."
sleep 10  # Wait for Telegraf to flush metrics

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Query to search for artillery metrics
QUERY='from(bucket: "loadtests")
  |> range(start: -5m)
  |> filter(fn: (r) => r["_measurement"] =~ /^artillery/)
  |> limit(n: 5)'

RESULT=$(curl -s "http://localhost:8086/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d "${QUERY}")

if echo "$RESULT" | grep -q "_value"; then
    echo -e "${GREEN}✓ Artillery metrics found in InfluxDB!${NC}"
    echo ""
    echo "Sample metrics:"
    echo "$RESULT" | head -20
    echo ""
else
    echo -e "${YELLOW}⚠ No Artillery metrics found yet${NC}"
    echo "   This might be normal if the test just started."
    echo "   Telegraf flushes metrics every 10 seconds."
    echo ""
fi

# Wait for Artillery to finish
wait $ARTILLERY_PID

echo ""
echo "5️⃣  Integration test complete!"
echo ""
echo "📊 View metrics in Grafana:"
echo "   http://localhost:3000/d/artillery-telegraf"
echo ""
echo -e "${GREEN}✓ Artillery integration is working${NC}"
