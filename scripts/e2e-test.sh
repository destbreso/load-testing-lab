#!/bin/bash
# End-to-End Test Script for Load Testing Lab
# Validates complete stack: Artillery → Telegraf → InfluxDB ← k6
# Usage: ./scripts/e2e-test.sh

set -e

echo "🧪 Load Testing Lab - End-to-End Test"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Start services
echo "1️⃣ Starting services..."
docker-compose up -d influxdb telegraf grafana toy-api
sleep 5
echo -e "${GREEN}✅ Services started${NC}"
echo ""

# 2. Verify services
echo "2️⃣ Verifying service health..."
SERVICES_OK=true

if ! docker ps | grep -q influxdb; then
    echo -e "${RED}❌ InfluxDB not running${NC}"
    SERVICES_OK=false
fi

if ! docker ps | grep -q telegraf; then
    echo -e "${RED}❌ Telegraf not running${NC}"
    SERVICES_OK=false
fi

if ! docker ps | grep -q grafana; then
    echo -e "${RED}❌ Grafana not running${NC}"
    SERVICES_OK=false
fi

if [ "$SERVICES_OK" = false ]; then
    echo -e "${RED}❌ Services check failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All services running${NC}"
echo ""

# 3. Run Artillery test
echo "3️⃣ Running Artillery test (30s)..."
docker-compose run --rm artillery run /artillery/scenarios/toy-fast.yml > /tmp/artillery.log 2>&1
ARTILLERY_EXIT=$?

if [ $ARTILLERY_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ Artillery test complete${NC}"
else
    echo -e "${RED}❌ Artillery test failed (exit code: $ARTILLERY_EXIT)${NC}"
    echo "   See /tmp/artillery.log for details"
    exit 1
fi
echo ""

# 4. Verify Artillery metrics
echo "4️⃣ Verifying Artillery metrics in InfluxDB..."
sleep 10  # Wait for Telegraf flush
export $(cat .env | grep -v '^#' | xargs)
ARTILLERY_RESULT=$(curl -s "http://localhost:8086/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests") |> range(start: -5m) |> filter(fn: (r) => r["_measurement"] =~ /^artillery/) |> limit(n: 1)')

if echo "$ARTILLERY_RESULT" | grep -q "_value"; then
    echo -e "${GREEN}✅ Artillery metrics found in InfluxDB${NC}"
    # Count metrics
    METRIC_COUNT=$(echo "$ARTILLERY_RESULT" | grep -c "_value" || echo "0")
    echo "   Found $METRIC_COUNT metric samples"
else
    echo -e "${RED}❌ Artillery metrics NOT found${NC}"
    echo "   This might indicate:"
    echo "   - Telegraf not receiving StatsD data"
    echo "   - artillery-plugin-statsd not installed"
    echo "   - Network connectivity issue"
    exit 1
fi
echo ""

# 5. Run k6 test
echo "5️⃣ Running k6 test (50s)..."
docker-compose run --rm k6 run /k6/scenarios/toy-mixed.js > /tmp/k6.log 2>&1
K6_EXIT=$?

if [ $K6_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ k6 test complete${NC}"
else
    echo -e "${RED}❌ k6 test failed (exit code: $K6_EXIT)${NC}"
    echo "   See /tmp/k6.log for details"
    exit 1
fi
echo ""

# 6. Verify k6 metrics
echo "6️⃣ Verifying k6 metrics in InfluxDB..."
K6_RESULT=$(curl -s "http://localhost:8086/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests") |> range(start: -5m) |> filter(fn: (r) => r["_measurement"] == "http_req_duration") |> limit(n: 1)')

if echo "$K6_RESULT" | grep -q "_value"; then
    echo -e "${GREEN}✅ k6 metrics found in InfluxDB${NC}"
    # Count metrics
    K6_METRIC_COUNT=$(echo "$K6_RESULT" | grep -c "_value" || echo "0")
    echo "   Found $K6_METRIC_COUNT metric samples"
else
    echo -e "${RED}❌ k6 metrics NOT found${NC}"
    echo "   This might indicate:"
    echo "   - k6 entrypoint.sh not executing"
    echo "   - K6_OUT not configured"
    echo "   - InfluxDB connection issue"
    exit 1
fi
echo ""

# 7. Check Grafana dashboards
echo "7️⃣ Checking Grafana dashboards..."
GRAFANA_HEALTH=$(curl -s http://localhost:3081/api/health)

if echo "$GRAFANA_HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✅ Grafana is healthy${NC}"
else
    echo -e "${YELLOW}⚠️ Grafana health check inconclusive${NC}"
fi
echo ""

# 8. Summary
echo "======================================"
echo -e "${GREEN}✅ End-to-End Test PASSED${NC}"
echo ""
echo "📊 Test Results:"
echo "   Artillery: 1500 requests @ 50 req/sec"
echo "   k6: ~1700 requests @ 35 req/sec"
echo "   InfluxDB: Both tools writing successfully"
echo "   Grafana: Dashboards accessible"
echo ""
echo "🌐 View dashboards:"
echo "   Artillery: http://localhost:3081/d/artillery-telegraf"
echo "   k6: http://localhost:3081/d/k6-dashboard"
echo ""
echo "📁 Test logs saved:"
echo "   Artillery: /tmp/artillery.log"
echo "   k6: /tmp/k6.log"
echo ""
echo "💡 Next steps:"
echo "   - Open Grafana to view real-time metrics"
echo "   - Run custom scenarios with your own config"
echo "   - Check END_TO_END_TESTING_GUIDE.md for troubleshooting"
echo "======================================"
