# End-to-End Testing & Troubleshooting Guide

> **Guide for validating the complete Load Testing Lab stack**  
> **Scripts**: `scripts/e2e-test.sh` and `scripts/test-artillery-integration.sh` automate the main checks

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
9. [Automated Testing Scripts](#automated-testing-scripts)

---

## Overview

This guide provides **step-by-step procedures** to validate the entire Load Testing Lab, from test execution through storage and visualization. Use this guide for:

- **Initial setup validation**
- **Verification after changes to the lab**
- **Troubleshooting issues**
- **Performance baseline establishment**
- **CI/CD pipeline integration**

Run the commands from the lab's root directory unless a step says otherwise.

### Architecture Flow

```
┌─────────────┐
│  Artillery  │──[publish-metrics, StatsD UDP 8125]──► Telegraf ──┐
└─────────────┘                                                   │
┌─────────────┐                                                   │
│     k6      │──[xk6-output-influxdb, HTTP]──────────────────────┤
└─────────────┘                                                   │
                                                                  ▼
                                                         ┌──────────────────┐
                                                         │   InfluxDB v2    │
                                                         │ (bucket from     │
                                                         │  INFLUXDB_BUCKET,│
                                                         │  default         │
                                                         │  loadtests)      │
                                                         └────────┬─────────┘
                                                                  │ [Flux Queries]
                                                                  ▼
                                                         ┌──────────────────┐
                                                         │     Grafana      │
                                                         │    Dashboards    │
                                                         └──────────────────┘
```

---

## Pre-Test Checklist

### 1. Environment File

Check the lab's configuration without printing secrets:

```bash
ltlab info
```

It shows the lab's `.env` (the InfluxDB token masked to its first 6 characters, passwords masked), the InfluxDB URL the host-side scripts use, each service's state and health, and the URLs with your ports.

**Expected:**
- An InfluxDB token, organization (`myorg` by default) and bucket (`loadtests` by default)
- If there is no `.env` yet, create it with `ltlab configure`, which also generates the token

### 2. Service Status

Start all required services:

```bash
ltlab start

# Or with Docker Compose, as scripts/e2e-test.sh does
docker compose up -d --wait influxdb telegraf grafana toy-api
```

Both return once every service is running and InfluxDB, Grafana and the toy API pass their health checks, so there is nothing to wait for afterwards. Then verify:

```bash
docker compose ps
```

**Expected:**
- Four services running: `influxdb`, `grafana`, `telegraf`, `toy-api`
- `influxdb`, `grafana` and `toy-api` show `(healthy)`; Telegraf has no health check
- Container names follow Compose's pattern, for example `load-testing-lab-influxdb-1`
- No `k6` or `artillery` container: they start only for a test

### 3. Network Connectivity

Test each service from your machine (with other ports in `.env`, use `INFLUXDB_PORT_EXPORT`, `GRAFANA_PORT` and `TOY_API_PORT`):

```bash
# InfluxDB: JSON with "status": "pass"
curl -s http://localhost:8086/health

# Grafana: JSON with "database": "ok"
curl -s http://localhost:3000/api/health

# Toy API: {"ok":true,"speed":"fast",...}
curl -s http://localhost:5000/fast
```

### 4. Telegraf Logs

Check Telegraf is listening on the StatsD port:

```bash
docker compose logs telegraf | tail -20
```

**Expected in logs:**
```
[inputs.statsd] UDP listening on "[::]:8125"
[inputs.statsd] Started the statsd service on ":8125"
```

---

## Artillery End-to-End Test

### Step 1: Build Artillery Image

`ltlab start` builds the Artillery image. To build it on its own:

```bash
docker compose build artillery
```

The image installs `artillery@2.0.34` on `node:22-alpine`. The publish-metrics plugin that sends metrics to Telegraf is part of Artillery, so there is nothing else to install. For a build from scratch, use `ltlab rebuild -s artillery`.

### Step 2: Run Artillery Test

Execute a 30-second load test:

```bash
ltlab artillery -s toy-fast.yml

# Or with Docker Compose
docker compose run --rm artillery run /artillery/scenarios/toy-fast.yml
```

**Expected output (excerpt):**
```
http.codes.200: ................................ 1500
http.requests: ................................. 1500
http.response_time:
  ...
  p95: ......................................... <ms>
  p99: ......................................... <ms>
vusers.completed: .............................. 1500
vusers.created: ................................ 1500
vusers.failed: ................................. 0

Checks:
ok: ...
```

**✅ Success Criteria:**
- 1500 virtual users created and completed (30s × 50 arrivals per second, one `GET /fast` each), 0 failed
- `http.codes.200` = 1500
- Under `Checks:`, the three `ensure` conditions (`p95 < 500`, `p99 < 1000`, `maxErrorRate < 1`) are marked `ok`
- Exit code 0 (`echo $?`); a missed check makes Artillery exit with 1

### Step 3: Verify Artillery Metrics in InfluxDB

Artillery reports every 10 seconds and Telegraf writes every 10 seconds, so wait about 20 seconds after the run, then sum the requests it stored:

```bash
# Load the lab's settings, as the e2e scripts do
set -a; . ./.env; set +a
INFLUX_URL="http://localhost:${INFLUXDB_PORT_EXPORT:-8086}"
BUCKET="${INFLUXDB_BUCKET:-loadtests}"

# Requests stored in the last 5 minutes
curl -s "${INFLUX_URL}/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "'"${BUCKET}"'")
      |> range(start: -5m)
      |> filter(fn: (r) => r["_measurement"] == "artillery" and r["_field"] == "http_requests")
      |> group()
      |> sum()'
```

**Expected:** a CSV result with one row whose `_value` is 1500, the `http.requests` of Artillery's summary (if no other Artillery run happened in those 5 minutes).

Responses per status code, in the same session:

```bash
curl -s "${INFLUX_URL}/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "'"${BUCKET}"'")
      |> range(start: -5m)
      |> filter(fn: (r) => r["_measurement"] == "artillery_http_codes")
      |> group(columns: ["_field"])
      |> sum()'
```

**✅ Success Criteria:**
- The sum of `http_requests` equals `http.requests` in the summary
- `artillery_http_codes` has a field `"200"` with the same total as `http.codes.200`
- The bucket also holds `artillery_http_response_time` (one row per 10-second period, with fields such as `p95` and `p99`), `artillery_vusers_session_length` and `artillery_vusers_created_by_name` (field `0` for this unnamed scenario)

The full schema is in [ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md#resulting-schema).

### Step 4: View Artillery Dashboard in Grafana

Open Grafana:

```bash
open http://localhost:3000/d/artillery-telegraf
```

**Login:** admin / admin123 (`GRAFANA_USER` and `GRAFANA_PASSWORD` in `.env`)

**Navigate to:**  
Dashboards → General → **Artillery + Telegraf - War Room**

**Expected panels:**
1. **Artillery Test Activity (Last 5min)** - Requests in the last 5 minutes
2. **Requests Per Second (RPS)** - About 50 during the run
3. **Response Latency** - Mean response time of each 10-second period
4. **Current RPS** - Artillery's latest request rate
5. **Total Requests** - 1500
6. **Recent Metrics (Last 5min)** - Latest rate, median, p95, p99 and status codes
7. **Response Time Percentiles** and the **"worst report"** stats

**✅ Success Criteria:**
- All panels display data within about 20 seconds of the run's end
- Request rate around 50 req/sec
- Total Requests = 1500, the same number as the summary

---

## k6 End-to-End Test

### Step 1: Run k6 Test

Execute a 50-second mixed-load test:

```bash
ltlab k6 -s toy-mixed.js

# Or with Docker Compose, as scripts/e2e-test.sh does
docker compose run --rm k6 run /k6/scenarios/toy-mixed.js
```

**Expected output (excerpt):**
```
✅ K6 InfluxDB configured:
   Organization: myorg
   Bucket: loadtests
   Addr: http://influxdb:8086

     execution: local
        script: /k6/scenarios/toy-mixed.js
        output: InfluxDBv2 (http://influxdb:8086)
  ...
    http_req_duration..............: avg=XXXms ...
    http_req_failed................: X.XX%  XX out of XXXX
    http_reqs......................: XXXX   XX.XX/s
    iterations.....................: XXXX   XX.XX/s
    vus_max........................: 60
```

**✅ Success Criteria:**
- The message "✅ K6 InfluxDB configured" appears (not a WARNING)
- `output: InfluxDBv2 (http://influxdb:8086)`
- `http_req_failed` around 3% (10% of iterations call `/error`, which fails 30% of the time)
- The run ends with exit code 0 (`toy-mixed.js` has no thresholds)

### Step 2: Verify k6 Metrics in InfluxDB

Query k6-specific metrics (in a shell where you loaded `.env` as in the Artillery step):

```bash
curl -s "${INFLUX_URL}/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "'"${BUCKET}"'")
      |> range(start: -5m)
      |> filter(fn: (r) => r["_measurement"] == "http_req_duration" and r["_field"] == "value")
      |> limit(n: 10)'
```

**Expected output:** rows of measurement `http_req_duration`, field `value` (the duration in milliseconds), with tags such as `method`, `name` (the request URL by default) and `status`.

Count the requests stored:

```bash
curl -s "${INFLUX_URL}/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "'"${BUCKET}"'")
      |> range(start: -5m)
      |> filter(fn: (r) => r["_measurement"] == "http_reqs" and r["_field"] == "value")
      |> group()
      |> count()'
```

**✅ Success Criteria:**
- Rows from `/fast`, `/slow`, `/users`, `/cpu` and `/error`
- Status codes 200 and 500
- The request count matches `http_reqs` in k6's summary

### Step 3: View k6 Dashboard in Grafana

**Navigate to:**  
Dashboards → General → **k6 Load Testing - War Room** (http://localhost:3000/d/k6-dashboard)

**Expected panels:**
1. **HTTP Request Duration (avg)** - Line chart with latency over time
2. **Virtual Users** - `vus` climbing to 60 and back down
3. **Total HTTP Requests** and **Total Iterations**
4. **Top 10 Slowest Endpoints** - `/slow` and `/cpu` at the top
5. **Response Time Percentiles** and the percentile stats

**✅ Success Criteria:**
- All panels display data during the run
- Request duration increases during load stages
- VUs ramp to 60 and back following the scenario
- Total HTTP Requests equals `http_reqs` in k6's summary

---

## Verification Procedures

### Quick Verification

The lab has commands for each check:

```bash
ltlab info             # .env (token masked), service state and health, URLs
ltlab metrics          # InfluxDB health, buckets and their retention
npm run check-influx   # The token in .env is accepted; lists the buckets
npm run tail-influx    # Rows written in the last hour
```

All of them read the lab's `.env` and reach InfluxDB at `http://localhost:<INFLUXDB_PORT_EXPORT or 8086>`.

### Manual Database Check

Check all measurements in InfluxDB (with `.env` loaded as above):

```bash
curl -s "${INFLUX_URL}/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'import "influxdata/influxdb/schema"
      schema.measurements(bucket: "'"${BUCKET}"'")'
```

**Expected measurements after both tests:**
- From Artillery (through Telegraf): `artillery`, `artillery_http_codes`, `artillery_http_response_time`, `artillery_vusers_session_length`, `artillery_vusers_created_by_name`, and `artillery_errors` when Artillery reported errors
- From k6: `http_req_duration`, `http_reqs`, `http_req_failed`, `http_req_blocked`, `http_req_connecting`, `http_req_tls_handshaking`, `http_req_sending`, `http_req_waiting`, `http_req_receiving`, `iterations`, `iteration_duration`, `vus`, `vus_max`, `data_sent`, `data_received`

---

## Troubleshooting Guide

### Problem: No Artillery Metrics in InfluxDB

**Symptoms:**
- Artillery test runs successfully
- InfluxDB query returns empty result

**Diagnosis:**
```bash
# 1. The scenario must have the publish-metrics block
grep -A 6 "publish-metrics" artillery/scenarios/toy-fast.yml

# 2. Check Telegraf logs for write errors
docker compose logs telegraf | grep -E "E!|error"

# 3. Send a test counter to Telegraf from your machine
echo "test.metric:1|c" | nc -u -w1 localhost 8125
```

After the third step, a measurement `test_metric` appears within about 10 seconds (`npm run tail-influx` shows it; `ltlab reset` clears the bucket afterwards). If it does, Telegraf and InfluxDB work, and the problem is on Artillery's side.

**Solution:**

**A) Telegraf not running:**
```bash
docker compose up -d --wait telegraf
docker compose logs telegraf
```

**B) Artillery container can't reach Telegraf:**
```bash
# Both services must be on the lab's network
docker network inspect load-testing-lab_ltl-net

# The artillery service sets STATSD_HOST=telegraf and STATSD_PORT=8125,
# and depends on telegraf (condition: service_started) in docker-compose.yml
```

**C) Scenario without the plugin, or with another prefix:**
```bash
cat artillery/scenarios/toy-fast.yml

# Should have:
# plugins:
#   publish-metrics:
#     - type: statsd
#       host: "{{ $processEnvironment.STATSD_HOST }}"
#       port: "{{ $processEnvironment.STATSD_PORT }}"
#       prefix: "artillery."
```

**D) Telegraf's writes rejected:** a `401` in Telegraf's logs means InfluxDB does not know the token in `.env`; see "Wrong token" under the k6 problem below.

---

### Problem: k6 Not Sending Metrics

**Symptoms:**
```
⚠️  WARNING: InfluxDB variables not configured, K6_OUT not available
...
        output: -
```

**Diagnosis:**

The k6 image's entrypoint turns the InfluxDB output on only when `INFLUXDB_ORG`, `INFLUXDB_BUCKET` and `INFLUXDB_TOKEN` are all set. The compose file gives the organization and bucket defaults, so the usual cause is a missing `INFLUXDB_TOKEN` in the lab's `.env`:

```bash
# The token appears masked when it is set
ltlab info
```

**Solution:**

**A) Token missing:**
```bash
# Generates INFLUXDB_TOKEN, keeps every other value
ltlab configure
```

InfluxDB adopts the token in `.env` only at its first setup. If InfluxDB was already set up with another token, see C.

**B) k6 binary without the InfluxDB output:** if k6 stops with an error about an invalid output type, the image was built without the extension. Rebuild it; its Dockerfile pins xk6 v1.4.14, k6 v1.8.1 and xk6-output-influxdb v0.7.0:
```bash
ltlab rebuild -s k6
```

**C) Wrong token:**
```bash
# A 401 means InfluxDB does not know the token in .env
npm run check-influx
```

Put back the token InfluxDB was set up with, or create a token in InfluxDB's UI (http://localhost:8086), write it to `INFLUXDB_TOKEN` in `.env` and run `ltlab restart -s all`. As a last resort, `ltlab purge` and `ltlab start` set InfluxDB up again with the token in `.env` (this deletes every stored metric).

---

### Problem: Grafana Shows "No Data"

**Symptoms:**
- Metrics exist in InfluxDB (verified by curl)
- Grafana dashboard panels show "No data"

**Diagnosis:**
```bash
# 1. Check Grafana datasource (user and password from .env)
curl -u admin:admin123 http://localhost:3000/api/datasources

# 2. Test datasource connection
# In Grafana UI: Connections → Data sources → InfluxDB → Test
```

**Solution:**

**A) Datasource not configured:**
```bash
# Recreate Grafana, which reads its provisioning files again
ltlab restart -s grafana

# Check provisioning logs
docker compose logs grafana | grep -i influx
```

**B) Wrong token:**

The datasource reads the token, organization and bucket from Grafana's environment, which Compose fills from `.env`. Fix the token in `.env` (see "Wrong token" above), then:
```bash
ltlab restart -s grafana
```

**C) Time range mismatch:**
- In Grafana, change time range to "Last 5 minutes"
- Artillery panels trail a run by up to about 20 seconds

**D) Query syntax error:**
- Run the panel's query against InfluxDB with curl, as in the steps above
- In Grafana, queries read `from(bucket: v.defaultBucket)`; with curl, write the bucket's name

---

### Problem: Telegraf Not Flushing Metrics

**Symptoms:**
- Artillery runs without errors
- Metrics arrive late or not at all

**Diagnosis:**
```bash
# Check Telegraf's intervals
docker compose exec telegraf grep -n "interval" /etc/telegraf/telegraf.conf
# [agent]: interval = "10s", flush_interval = "10s"; [[inputs.statsd]]: interval = "1s"

# Check Telegraf logs for errors
docker compose logs telegraf | grep -E "E!|error"
```

**Solution:**
```bash
# Recreate Telegraf
ltlab restart -s telegraf
```

---

### Problem: Services Won't Start

**Symptoms:**
```
Error response from daemon: driver failed programming external connectivity
```
or `ltlab start` stops with "There is no .env file yet." or "INFLUXDB_TOKEN is missing from .env."

**Diagnosis:**
```bash
# Check port conflicts
lsof -i :8086      # InfluxDB
lsof -i :3000      # Grafana
lsof -i :5000      # Toy API
lsof -i UDP:8125   # Telegraf StatsD
```

**Solution:**
- Missing `.env` or token: run `ltlab configure`
- Option 1: Stop conflicting services
- Option 2: Set `INFLUXDB_PORT_EXPORT`, `GRAFANA_PORT` or `TOY_API_PORT` in the lab's `.env`, then `ltlab start` (the StatsD port, 8125/udp, is fixed in the compose file)

---

## Performance Benchmarks

### Expected Metrics: toy-fast.yml (Artillery)

| Metric | Expected Value | Acceptance Threshold |
|--------|----------------|---------------------|
| Arrivals | 50 virtual users/sec for 30s | Set by the scenario |
| Total Requests (30s) | 1500 | Exact |
| p95 Latency | Depends on the machine | < 500ms (`ensure`) |
| p99 Latency | Depends on the machine | < 1000ms (`ensure`) |
| Error Rate | 0% | < 1% (`ensure`) |
| VUs Failed | 0 | 0 |

### Expected Metrics: toy-mixed.js (k6)

| Metric | Expected Value | Acceptance Threshold |
|--------|----------------|---------------------|
| Duration | 50s (10s ramp-up, 30s ramp to 60, 10s ramp-down) | Set by the scenario |
| Max VUs | 60 | Exact |
| Failed Requests | About 3% | No threshold |
| p95 Latency | About 2s | No threshold |
| p99 Latency | About 2.4s | No threshold |

The request rate depends on response times and each iteration's random pause (0 to 1.2s). The percentiles come from `/slow`, which takes 500-2500ms and serves a fifth of the requests.

### Infrastructure Usage

Check the containers' memory and CPU at any time:

```bash
docker stats --no-stream
```

---

## Advanced Diagnostics

### Enable Debug Logging

**Telegraf:**
```bash
# Edit telegraf/telegraf.conf
[agent]
  debug = true
  quiet = false

# Recreate Telegraf
ltlab restart -s telegraf

# View debug logs
docker compose logs -f telegraf
```

**k6:**
```bash
# Run with verbose logging
docker compose run --rm k6 run --verbose /k6/scenarios/toy-mixed.js
```

### Network Packet Capture

Capture StatsD packets:

```bash
# Install tcpdump in Telegraf container
docker compose exec telegraf sh -c "apk add tcpdump"

# Capture UDP packets on port 8125
docker compose exec telegraf tcpdump -i any -n udp port 8125 -A

# Run an Artillery test in another terminal. You should see lines such as
#   artillery.http.requests:500|c                (a counter)
#   artillery.http.response_time.p95:4|g         (a gauge)
```

### InfluxDB Query Performance

Check query execution time (with `.env` loaded as above):

```bash
time curl -s "${INFLUX_URL}/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "'"${BUCKET}"'") |> range(start: -1h) |> count()'
```

**Expected:** < 1 second for hourly range

### Series Cardinality

Every distinct combination of measurement, tags and field is a series, and many series make queries slower. The lab keeps their number bounded:
- Telegraf drops Artillery's per-endpoint metrics (`namedrop = ["artillery_plugins"]`)
- k6's output stores the request URL as a field, not a tag

k6's `name` tag still defaults to the request URL. For URLs that carry IDs, give the requests a fixed name, so they share one series:

```javascript
http.get(`${__ENV.TARGET_API_URL}/jobs/${jobId}`, { tags: { name: 'jobs-by-id' } });
```

---

## Success Validation Checklist

Use this checklist to confirm complete end-to-end functionality:

### ✅ Infrastructure
- [ ] `ltlab start` (or `docker compose up -d --wait`) returns without errors
- [ ] InfluxDB, Grafana and the toy API show `(healthy)`
- [ ] Grafana accessible at http://localhost:3000
- [ ] Telegraf listening on UDP 8125

### ✅ Artillery Integration
- [ ] Artillery image builds (`artillery@2.0.34`)
- [ ] `toy-fast.yml` ends with every check `ok` and exit code 0
- [ ] Metrics appear in InfluxDB within about 20 seconds
- [ ] The sum of `http_requests` equals `http.requests` in Artillery's summary
- [ ] Grafana dashboard shows Artillery data

### ✅ k6 Integration
- [ ] k6 prints "✅ K6 InfluxDB configured" and `output: InfluxDBv2 (http://influxdb:8086)`
- [ ] Test completes successfully
- [ ] Metrics appear in InfluxDB during the run
- [ ] Grafana dashboard shows k6 data
- [ ] VUs ramp correctly (up to 60 and back down)

### ✅ Data Persistence
- [ ] Metrics survive `ltlab restart -s grafana`
- [ ] Metrics survive `ltlab stop` and `ltlab start` (they live on the `influxdb-data` volume)
- [ ] Dashboards update every 5 seconds during tests
- [ ] No data gaps or missing measurements

### ✅ Performance
- [ ] `toy-fast.yml` checks pass: p95 < 500ms, p99 < 1000ms
- [ ] Error rates within thresholds
- [ ] No container OOM kills

---

## Automated Testing Scripts

Both scripts change to the lab's root directory themselves and read the lab's `.env` (token, organization, bucket and ports), so they run from anywhere.

### scripts/e2e-test.sh

```bash
./scripts/e2e-test.sh
```

What it does:
1. Starts `influxdb`, `telegraf`, `grafana` and `toy-api` with `docker compose up -d --wait`
2. Checks that the InfluxDB, Telegraf and Grafana containers are running
3. Runs `toy-fast.yml` with Artillery (30s), with its output in `/tmp/artillery.log`
4. Waits 10 seconds, then looks for any `artillery*` measurement written to InfluxDB in the last 5 minutes
5. Runs `toy-mixed.js` with k6 (50s), with its output in `/tmp/k6.log`
6. Looks for `http_req_duration` rows written in the last 5 minutes
7. Checks Grafana's `/api/health` (a warning, not a failure, if it is inconclusive)
8. Prints "End-to-End Test PASSED" and the dashboard URLs

The script stops at the first failing step (`set -e`). A run that fails, for example an Artillery `ensure` check that is missed, stops it at that step; the run's output is in `/tmp/artillery.log` or `/tmp/k6.log`.

### scripts/test-artillery-integration.sh

```bash
./scripts/test-artillery-integration.sh
```

What it does:
1. Starts Telegraf (`docker compose up -d --wait telegraf`) if it is not running
2. Stops with a hint if InfluxDB is not running
3. Starts `toy-fast.yml` with Artillery in the background
4. After 15 seconds, queries InfluxDB for `artillery*` rows from the last 5 minutes and prints a sample; if none has arrived yet, it prints a warning instead of failing
5. Waits for Artillery to finish (a failed run, such as a missed `ensure` check, stops the script)

---

## Conclusion

These procedures check the lab end to end. By following them, you can:

- ✅ Verify complete data flow from tests to visualization
- ✅ Diagnose and fix common issues systematically  
- ✅ Establish performance baselines
- ✅ Prepare the lab for CI/CD pipelines

For additional help, see:
- [ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md) - Artillery integration details
- [DIAGNOSIS_AND_SOLUTION.md](DIAGNOSIS_AND_SOLUTION.md) - How the k6 to InfluxDB pipeline works
- [README.md](README.md) - Documentation hub
- [Blog: CI/CD Integration](https://destbreso.com/blog/load-tests-in-ci-cd) - Automating validation tests
- [Blog: Performance Optimization](https://destbreso.com/blog/from-load-test-metrics-to-performance-fixes) - Analyzing test results

**Test Duration:** about 2 minutes for `scripts/e2e-test.sh` once the images are built (30s of Artillery, 50s of k6, and the waits in between)
