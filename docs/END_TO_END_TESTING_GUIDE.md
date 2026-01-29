# End-to-End Testing & Troubleshooting Guide

> **Professional guide for validating the complete Load Testing Lab stack**  
> **Status**: Production-ready validation procedures  
> **Last Updated**: January 24, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Test Checklist](#pre-test-checklist)
3. [Artillery End-to-End Test](#artillery-end-to-end-test)
4. [k6 End-to-End Test](#k6-end-to-end-test)
5. [Verification Procedures](#verification-procedures)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Performance Benchmarks](#performance-benchmarks)
8. [Advanced Diagnostics](#advanced-diagnostics)

---

## Overview

This guide provides **step-by-step procedures** to validate the entire Load Testing Lab infrastructure, from test execution through data persistence and visualization. Use this guide for:

- **Initial setup validation**
- **Post-deployment verification**
- **Troubleshooting issues**
- **Performance baseline establishment**
- **CI/CD pipeline integration**

### Architecture Flow

```
┌─────────────┐
│   Test      │  Artillery or k6
│   Runner    │  
└──────┬──────┘
       │
       ├──[StatsD:8125]──────► Telegraf ──┐
       │                                   │
       └──[InfluxDB Line]─────────────────┤
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  InfluxDB v2 │
                                    │ (bucket:     │
                                    │  loadtests)  │
                                    └──────┬───────┘
                                           │
                                           │ [Flux Queries]
                                           ▼
                                    ┌──────────────┐
                                    │   Grafana    │
                                    │  Dashboards  │
                                    └──────────────┘
```

---

## Pre-Test Checklist

### 1. Environment File

Verify `.env` file exists with correct credentials:

```bash
cat .env
```

**Expected output:**
```env
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=loadtests
INFLUXDB_TOKEN=admin123
```

### 2. Service Status

Start all required services:

```bash
docker-compose up -d influxdb telegraf grafana toy-api
```

Wait 5 seconds for initialization, then verify:

```bash
docker-compose ps
```

**Expected output:**
```
NAME       IMAGE                   STATUS          PORTS
influxdb   influxdb:2.6            Up 10 seconds   0.0.0.0:8086->8086/tcp
telegraf   telegraf:1.28-alpine    Up 10 seconds   0.0.0.0:8125->8125/udp
grafana    grafana/grafana:10.1.0  Up 10 seconds   0.0.0.0:3081->3000/tcp
toy-api    load-testing-lab-toy-api Up 10 seconds  0.0.0.0:5081->5000/tcp
```

### 3. Network Connectivity

Test internal service connectivity:

```bash
# Test InfluxDB API
curl -I http://localhost:8086/health

# Test Grafana
curl -I http://localhost:3081/api/health

# Test Toy API
curl http://localhost:5081/fast
```

**All should return HTTP 200.**

### 4. Telegraf Logs

Check Telegraf is listening on StatsD port:

```bash
docker-compose logs telegraf | tail -20
```

**Expected in logs:**
```
[inputs.statsd] UDP listening on "[::]:8125"
[inputs.statsd] Started the statsd service on ":8125"
```

---

## Artillery End-to-End Test

### Step 1: Build Artillery Image

Ensure Artillery has the StatsD plugin:

```bash
docker-compose build artillery
```

**Expected output:**
```
[+] Building X.Xs
 => [2/3] RUN npm install -g artillery artillery-plugin-statsd
 => exporting to image
 ✔ Image load-testing-lab-artillery Built
```

### Step 2: Run Artillery Test

Execute a 30-second load test:

```bash
docker-compose run --rm artillery run /artillery/scenarios/toy-fast.yml
```

**Expected output:**
```
Test run id: [random_id]
Phase started: unnamed (index: 0, duration: 30s)

Summary report:
http.codes.200: ................................ 1500
http.request_rate: ............................. 50/sec
http.response_time:
  p95: ......................................... 2ms
  p99: ......................................... 4ms
vusers.completed: .............................. 1500
vusers.failed: ................................. 0
```

**✅ Success Criteria:**
- No "Could not load plugin: statsd" warnings
- Request rate = 50 req/sec
- 0 failed virtual users
- http.codes.200 = ~1500 (30s × 50 req/sec)

### Step 3: Verify Artillery Metrics in InfluxDB

Wait 10 seconds for Telegraf flush, then query:

```bash
# Load environment
export $(cat .env | grep -v '^#' | xargs)

# Query Artillery metrics
curl -s "http://localhost:8086/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests")
      |> range(start: -5m)
      |> filter(fn: (r) => r["_measurement"] =~ /^artillery/)
      |> limit(n: 10)'
```

**Expected output (CSV format):**
```csv
,result,table,_time,_value,_field,_measurement,host
,_result,0,2026-01-24T16:07:00Z,500,codes,artillery,telegraf
,_result,1,2026-01-24T16:07:00Z,2,latency,artillery,telegraf
,_result,2,2026-01-24T16:07:00Z,500,rps,artillery,telegraf
...
```

**✅ Success Criteria:**
- Response contains rows with `_measurement=artillery`
- Fields include: `codes`, `latency`, `rps`, `scenarioCounts`
- Timestamps within last 5 minutes

### Step 4: View Artillery Dashboard in Grafana

Open Grafana:

```bash
open http://localhost:3081
```

**Login:** admin / admin (first time: skip password change)

**Navigate to:**  
Dashboards → Load Testing Lab → **Artillery + Telegraf - Real-time Metrics**

**Expected panels:**
1. ✅ **Artillery Test Active** - Should show "green" if run within last 5 minutes
2. 📈 **Request Latency Over Time** - Line chart with latency data
3. 📊 **Request Rate (requests/sec)** - ~50 req/sec during test
4. 🎯 **Current RPS (Gauge)** - Shows recent request rate
5. 🔢 **Total Requests** - ~1500
6. 📋 **Recent Metrics Summary** - Table with aggregated data

**✅ Success Criteria:**
- All panels display data (no "No data" message)
- Request rate peaks at ~50 req/sec
- Total requests ≈ 1500
- Latency p95 < 10ms for toy-fast scenario

---

## k6 End-to-End Test

### Step 1: Run k6 Test

Execute a 50-second mixed-load test:

```bash
docker-compose run --rm k6 run /k6/scenarios/toy-mixed.js
```

**Expected output:**
```
✅ K6 InfluxDB configurado:
   Organización: myorg
   Bucket: loadtests
   Addr: http://influxdb:8086

     execution: local
        script: /k6/scenarios/toy-mixed.js
        output: InfluxDBv2 (http://influxdb:8086)

     scenarios: (100.00%) 1 scenario, 60 max VUs

  █ TOTAL RESULTS 

    http_req_duration..............: avg=XXXms p(90)=XXXms p(95)=XXXms
    http_req_failed................: X.XX%  XX out of XXXX
    http_reqs......................: XXXX   XX.XX/s
    iterations.....................: XXXX   XX.XX/s
    vus............................: X      min=2  max=59
```

**✅ Success Criteria:**
- Message "K6 InfluxDB configurado" appears
- output = "InfluxDBv2 (http://influxdb:8086)"
- http_req_failed < 5%
- Test completes without errors

### Step 2: Verify k6 Metrics in InfluxDB

Query k6-specific metrics:

```bash
export $(cat .env | grep -v '^#' | xargs)

curl -s "http://localhost:8086/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests")
      |> range(start: -5m)
      |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
      |> limit(n: 10)'
```

**Expected output:**
```csv
,result,table,_time,_value,_field,_measurement,method,name,status
,_result,0,2026-01-24T16:08:00Z,2.119,value,http_req_duration,GET,http://toy-api:5000/fast,200
,_result,1,2026-01-24T16:08:01Z,1.091,value,http_req_duration,GET,http://toy-api:5000/slow,200
...
```

**✅ Success Criteria:**
- Response contains `_measurement=http_req_duration`
- Multiple endpoints visible: `/fast`, `/slow`, `/cpu`, `/error`
- Status codes: 200, 500
- Timestamps within last 5 minutes

### Step 3: View k6 Dashboard in Grafana

**Navigate to:**  
Dashboards → Load Testing Lab → **k6 Dashboard**

**Expected panels:**
1. 📈 **Request Duration (p95)** - Line chart showing latency trends
2. 📊 **Request Rate** - Requests per second over time
3. ⚠️ **Error Rate** - Failed requests percentage
4. 👥 **Concurrent Users** - Virtual users ramping up/down
5. 🔧 **Worker Latency** - If using async endpoints

**✅ Success Criteria:**
- All panels display data
- Request duration increases during load stages
- VUs ramp from 2 → 60 → 2 following scenario
- Error rate < 5%

---

## Verification Procedures

### Quick Verification Script

Create and run this validation script:

```bash
#!/bin/bash
# File: scripts/verify-stack.sh

echo "🔍 Verifying Load Testing Lab Stack..."
echo ""

# Check services
echo "1️⃣ Checking services..."
docker-compose ps | grep -E "(influxdb|telegraf|grafana)" | grep -q "Up" && echo "✅ Core services running" || echo "❌ Services down"

# Check InfluxDB
echo ""
echo "2️⃣ Checking InfluxDB..."
curl -sf http://localhost:8086/health > /dev/null && echo "✅ InfluxDB healthy" || echo "❌ InfluxDB unreachable"

# Check Telegraf StatsD port
echo ""
echo "3️⃣ Checking Telegraf..."
docker-compose logs telegraf 2>&1 | grep -q "Started the statsd service" && echo "✅ Telegraf StatsD active" || echo "❌ Telegraf not listening"

# Check Grafana
echo ""
echo "4️⃣ Checking Grafana..."
curl -sf http://localhost:3081/api/health > /dev/null && echo "✅ Grafana healthy" || echo "❌ Grafana unreachable"

# Check metrics in last 5 minutes
echo ""
echo "5️⃣ Checking recent metrics..."
export $(cat .env | grep -v '^#' | xargs)
RESULT=$(curl -s "http://localhost:8086/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests") |> range(start: -5m) |> limit(n: 1)')

if echo "$RESULT" | grep -q "_value"; then
    echo "✅ Recent metrics found"
else
    echo "⚠️ No recent metrics (run a test first)"
fi

echo ""
echo "✅ Verification complete"
```

**Run:**
```bash
chmod +x scripts/verify-stack.sh
./scripts/verify-stack.sh
```

### Manual Database Inspection

Check all measurements in InfluxDB:

```bash
export $(cat .env | grep -v '^#' | xargs)

curl -s "http://localhost:8086/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'import "influxdata/influxdb/schema"
      schema.measurements(bucket: "loadtests")'
```

**Expected measurements:**
- `artillery` (from Telegraf/StatsD)
- `http_req_duration` (from k6)
- `http_reqs` (from k6)
- `vus` (from k6)
- `data_sent` (from k6)
- `iteration_duration` (from k6)

---

## Troubleshooting Guide

### Problem: Artillery "Could not load plugin: statsd"

**Symptoms:**
```
WARNING: Could not load plugin: statsd
WARNING: Plugin statsd specified but module artillery-plugin-statsd could not be found
```

**Diagnosis:**
```bash
# Check if plugin is installed
docker-compose run --rm artillery sh -c "npm list -g | grep artillery-plugin-statsd"
```

**Solution:**
```bash
# Rebuild Artillery image
docker-compose build artillery

# Verify Dockerfile
cat artillery/Dockerfile
# Should contain: RUN npm install -g artillery artillery-plugin-statsd
```

---

### Problem: No Artillery Metrics in InfluxDB

**Symptoms:**
- Artillery test runs successfully
- No "plugin error" warnings
- InfluxDB query returns empty result

**Diagnosis:**
```bash
# 1. Check Telegraf logs
docker-compose logs telegraf | grep -i error

# 2. Check if Telegraf is receiving StatsD packets
docker-compose exec telegraf netstat -anu | grep 8125

# 3. Test StatsD connectivity
echo "test.metric:1|c" | nc -u -w1 localhost 8125
```

**Solution:**

**A) Telegraf not running:**
```bash
docker-compose up -d telegraf
docker-compose logs telegraf
```

**B) Artillery container can't reach Telegraf:**
```bash
# Check docker network
docker network inspect load-testing-lab_ltl-net

# Verify Artillery depends_on in docker-compose.yml
# Should have: depends_on: - telegraf
```

**C) Wrong environment variables:**
```bash
# Check Artillery scenario YAML
cat artillery/scenarios/toy-fast.yml

# Should have:
# plugins:
#   statsd:
#     host: "{{ $processEnvironment.STATSD_HOST }}"
#     port: "{{ $processEnvironment.STATSD_PORT }}"
```

---

### Problem: k6 Not Sending Metrics

**Symptoms:**
```
output: -
```
(No InfluxDBv2 output shown)

**Diagnosis:**
```bash
# Check k6 entrypoint
docker-compose run --rm k6 sh -c 'echo $K6_OUT'
# Should output: xk6-influxdb=http://influxdb:8086

# Check container logs
docker-compose logs k6 2>&1 | grep -i influx
```

**Solution:**

**A) Entrypoint not running:**
```bash
# Verify k6/entrypoint.sh exists
cat k6/entrypoint.sh

# Rebuild k6 image
docker-compose build k6
```

**B) InfluxDB unreachable:**
```bash
# Test from k6 container
docker-compose run --rm k6 sh -c "curl -I http://influxdb:8086/health"
# Should return HTTP 200
```

**C) Wrong credentials:**
```bash
# Verify .env matches Grafana datasource
cat .env
cat grafana/provisioning/datasources/influxdb.yaml
# Token should match
```

---

### Problem: Grafana Shows "No Data"

**Symptoms:**
- Metrics exist in InfluxDB (verified by curl)
- Grafana dashboard panels show "No data"

**Diagnosis:**
```bash
# 1. Check Grafana datasource
curl -u admin:admin http://localhost:3081/api/datasources

# 2. Test datasource connection
# In Grafana UI: Configuration → Data Sources → InfluxDB → Save & Test
```

**Solution:**

**A) Datasource not configured:**
```bash
# Restart Grafana to reload provisioning
ltlab restart -s grafana
# Or manually: docker-compose restart grafana

# Check provisioning logs
docker-compose logs grafana | grep -i influx
```

**B) Wrong token:**
```bash
# Update grafana/provisioning/datasources/influxdb.yaml
# Set secureJsonData.token to match .env INFLUXDB_TOKEN

# Restart Grafana
ltlab restart -s grafana
# Or manually: docker-compose restart grafana
```

**C) Time range mismatch:**
- In Grafana, change time range to "Last 5 minutes"
- Check if data appears

**D) Query syntax error:**
```bash
# Test query directly
export $(cat .env | grep -v '^#' | xargs)

curl -s "http://localhost:8086/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests") |> range(start: -1h) |> limit(n: 1)'

# If this works, issue is in Grafana query
```

---

### Problem: Telegraf Not Flushing Metrics

**Symptoms:**
- Artillery runs without errors
- Metrics delayed or batched weirdly

**Diagnosis:**
```bash
# Check Telegraf config
docker-compose exec telegraf cat /etc/telegraf/telegraf.conf | grep flush_interval
# Should be: flush_interval = "10s"

# Check Telegraf logs for errors
docker-compose logs telegraf | grep -E "(error|ERROR)"
```

**Solution:**
```bash
# Restart Telegraf
ltlab restart -s telegraf
# Or manually: docker-compose restart telegraf

# If errors persist, check telegraf.conf syntax
docker-compose exec telegraf telegraf --config /etc/telegraf/telegraf.conf --test
```

---

### Problem: Services Won't Start

**Symptoms:**
```
Error response from daemon: driver failed programming external connectivity
```

**Diagnosis:**
```bash
# Check port conflicts
lsof -i :8086  # InfluxDB
lsof -i :3081  # Grafana
lsof -i :8125  # Telegraf StatsD
```

**Solution:**
```bash
# Option 1: Stop conflicting services
# Option 2: Change ports in docker-compose.yml
# Option 3: Use different port mapping
```

---

## Performance Benchmarks

### Expected Metrics: toy-fast.yml (Artillery)

| Metric | Expected Value | Acceptance Threshold |
|--------|----------------|---------------------|
| Request Rate | 50 req/sec | ±5 req/sec |
| Total Requests (30s) | 1500 | ±50 |
| p95 Latency | < 5ms | < 10ms |
| p99 Latency | < 10ms | < 20ms |
| Error Rate | 0% | < 1% |
| VUs Failed | 0 | 0 |

### Expected Metrics: toy-mixed.js (k6)

| Metric | Expected Value | Acceptance Threshold |
|--------|----------------|---------------------|
| Request Rate | 30-40 req/sec | ±10 req/sec |
| Total Requests (50s) | 1500-2000 | ±200 |
| p95 Latency | < 2s | < 3s |
| p99 Latency | < 2.5s | < 4s |
| Error Rate | < 5% | < 10% |
| Max VUs | 60 | Exact |

### Infrastructure Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| InfluxDB Memory | ~200MB | For 5-minute retention window |
| Telegraf Memory | ~50MB | With default buffer |
| Grafana Memory | ~150MB | With 2 dashboards |
| Total Docker | ~500MB | Baseline without tests |

---

## Advanced Diagnostics

### Enable Debug Logging

**Telegraf:**
```bash
# Edit telegraf.conf
[agent]
  debug = true
  quiet = false

# Restart
ltlab restart -s telegraf
# Or manually: docker-compose restart telegraf

# View debug logs
docker-compose logs -f telegraf
```

**k6:**
```bash
# Run with verbose logging
docker-compose run --rm k6 run --verbose /k6/scenarios/toy-mixed.js
```

### Network Packet Capture

Capture StatsD packets:

```bash
# Install tcpdump in Telegraf container
docker-compose exec telegraf sh -c "apk add tcpdump"

# Capture UDP packets on port 8125
docker-compose exec telegraf tcpdump -i any -n udp port 8125 -A

# Run Artillery test in another terminal
# You should see: artillery.codes:500|g
```

### InfluxDB Query Performance

Check query execution time:

```bash
export $(cat .env | grep -v '^#' | xargs)

time curl -s "http://localhost:8086/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests") |> range(start: -1h) |> count()'
```

**Expected:** < 1 second for hourly range

### Metrics Cardinality

Check unique tag combinations (cardinality):

```bash
curl -s "http://localhost:8086/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'import "influxdata/influxdb/schema"
      schema.tagValues(
        bucket: "loadtests",
        tag: "_measurement"
      )'
```

**High cardinality = slower queries**

---

## Success Validation Checklist

Use this checklist to confirm complete end-to-end functionality:

### ✅ Infrastructure
- [ ] All services start without errors
- [ ] InfluxDB health check passes
- [ ] Grafana accessible at http://localhost:3081
- [ ] Telegraf listening on UDP 8125

### ✅ Artillery Integration
- [ ] Artillery image builds with statsd plugin
- [ ] Test runs without plugin warnings
- [ ] Metrics appear in InfluxDB within 10 seconds
- [ ] Grafana dashboard shows Artillery data
- [ ] Request rate = ~50 req/sec for toy-fast

### ✅ k6 Integration
- [ ] k6 shows "InfluxDBv2" output on start
- [ ] Test completes successfully
- [ ] Metrics appear in InfluxDB immediately
- [ ] Grafana dashboard shows k6 data
- [ ] VUs ramp correctly (2 → 60 → 2)

### ✅ Data Persistence
- [ ] Metrics survive Grafana restart
- [ ] Queries return data from 5+ minutes ago
- [ ] Dashboard updates in real-time during tests
- [ ] No data gaps or missing measurements

### ✅ Performance
- [ ] k6 p95 latency < 2s for toy-mixed
- [ ] Artillery p95 latency < 5ms for toy-fast
- [ ] Error rates within thresholds
- [ ] No container OOM kills

---

## Automated Testing Script

Create a complete validation script:

```bash
#!/bin/bash
# File: scripts/e2e-test.sh

set -e

echo "🧪 Load Testing Lab - End-to-End Test"
echo "======================================"
echo ""

# 1. Start services
echo "1️⃣ Starting services..."
docker-compose up -d influxdb telegraf grafana toy-api
sleep 5
echo "✅ Services started"
echo ""

# 2. Run Artillery test
echo "2️⃣ Running Artillery test (30s)..."
docker-compose run --rm artillery run /artillery/scenarios/toy-fast.yml > /tmp/artillery.log 2>&1
echo "✅ Artillery test complete"
echo ""

# 3. Verify Artillery metrics
echo "3️⃣ Verifying Artillery metrics in InfluxDB..."
sleep 10  # Wait for Telegraf flush
export $(cat .env | grep -v '^#' | xargs)
ARTILLERY_RESULT=$(curl -s "http://localhost:8086/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests") |> range(start: -5m) |> filter(fn: (r) => r["_measurement"] =~ /^artillery/) |> limit(n: 1)')

if echo "$ARTILLERY_RESULT" | grep -q "_value"; then
    echo "✅ Artillery metrics found in InfluxDB"
else
    echo "❌ Artillery metrics NOT found"
    exit 1
fi
echo ""

# 4. Run k6 test
echo "4️⃣ Running k6 test (50s)..."
docker-compose run --rm k6 run /k6/scenarios/toy-mixed.js > /tmp/k6.log 2>&1
echo "✅ k6 test complete"
echo ""

# 5. Verify k6 metrics
echo "5️⃣ Verifying k6 metrics in InfluxDB..."
K6_RESULT=$(curl -s "http://localhost:8086/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests") |> range(start: -5m) |> filter(fn: (r) => r["_measurement"] == "http_req_duration") |> limit(n: 1)')

if echo "$K6_RESULT" | grep -q "_value"; then
    echo "✅ k6 metrics found in InfluxDB"
else
    echo "❌ k6 metrics NOT found"
    exit 1
fi
echo ""

# 6. Summary
echo "======================================"
echo "✅ End-to-End Test PASSED"
echo ""
echo "📊 View dashboards:"
echo "   Artillery: http://localhost:3081/d/artillery-telegraf"
echo "   k6: http://localhost:3081/d/k6-dashboard"
echo ""
echo "📁 Test logs saved:"
echo "   Artillery: /tmp/artillery.log"
echo "   k6: /tmp/k6.log"
echo "======================================"
```

**Run:**
```bash
chmod +x scripts/e2e-test.sh
./scripts/e2e-test.sh
```

---

## Conclusion

This guide provides **production-grade validation procedures** for the Load Testing Lab. By following these steps, you can:

- ✅ Verify complete data flow from tests to visualization
- ✅ Diagnose and fix common issues systematically  
- ✅ Establish performance baselines
- ✅ Ensure CI/CD pipeline readiness

For additional help, see:
- [ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md) - Artillery integration details
- [DIAGNOSIS_AND_SOLUTION.md](DIAGNOSIS_AND_SOLUTION.md) - k6 troubleshooting
- [README.md](README.md) - General usage and architecture
- [Blog: CI/CD Integration](../blog/advanced/art5.md) - Automating validation tests
- [Blog: Performance Optimization](../blog/advanced/art8.md) - Analyzing test results

**Last Validated:** January 24, 2026  
**Test Duration:** ~2 minutes (Artillery + k6)  
**Success Rate:** 100% on validated infrastructure
