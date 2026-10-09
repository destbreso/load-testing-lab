# Dashboards Guide

Complete guide to the Grafana dashboards that visualize the lab's load tests.

## Table of Contents

1. [Overview](#overview)
2. [Available Dashboards](#available-dashboards)
3. [Accessing Dashboards](#accessing-dashboards)
4. [Dashboard Architecture](#dashboard-architecture)
5. [Key Metrics Explained](#key-metrics-explained)
6. [Customizing Dashboards](#customizing-dashboards)
7. [Custom Metrics](#custom-metrics)
8. [Troubleshooting Dashboards](#troubleshooting-dashboards)

---

## Overview

The Load Testing Lab provisions **6 Grafana dashboards** (3 for k6, 3 for Artillery) that chart the metrics of your load tests while they run.

### Features

✅ **Auto-provisioned** - Loaded from `grafana/dashboards/`, no import needed  
✅ **Live updates** - Every dashboard refreshes every 5 seconds; the default time range is the last 30 minutes  
✅ **Zero configuration** - Every query reads the datasource's bucket (`v.defaultBucket`, set from `INFLUXDB_BUCKET`)  
✅ **Three tiers** - War Room (basic), Pro, Elite  
✅ **Flux queries** - InfluxDB v2  

### Dashboard Tiers

- **Basic (War Room)**: Quick overview during a run
- **Pro**: Detailed breakdowns
- **Elite**: The most panels, including a latency heatmap and success-rate stats

---

## Available Dashboards

### k6 Dashboards

k6 writes one sample per request to InfluxDB, so the k6 percentile panels and stats are computed from every request's duration. They merge all series with `group()`: each percentile is one line in the chart, and each stat is one number for the selected range.

#### 1. k6 Load Testing - War Room (Basic)

**UID:** `k6-dashboard`  
**URL:** http://localhost:3000/d/k6-dashboard  
**Refresh:** 5 seconds

**Panels:**
- k6 Test Activity (Last 5min) - Above zero while k6 has written request samples in the last 5 minutes (an activity signal; Total HTTP Requests is the exact count)
- HTTP Request Duration (avg)
- Virtual Users - `vus` and `vus_max`
- Total HTTP Requests and Total Iterations - Counts in the selected range
- Top 10 Slowest Endpoints - Average duration by request name, status and method
- Response Time Percentiles (p50, p75, p90, p95, p99) - One line per percentile
- Percentile stats p50, p75, p90, p95, p99 - One value each for the selected range

**Best for:**
- Quick health checks
- Smoke tests
- Initial test runs

---

#### 2. K6 Elite Performance War Room

**UID:** `k6-elite`  
**URL:** http://localhost:3000/d/k6-elite  
**Refresh:** 5 seconds

**Panels:**
- **Latency Percentiles (Mean Duration)** - Mean request duration per window, one line per series
- **Latency Heatmap** - Mean request durations as a heatmap
- **Requests Per Second (Traffic)** - Requests counted per window, divided by the window's length in seconds
- **Error Rate (%)** - Share of failed requests (`http_req_failed`) per window
- **Virtual Users (Load)** - `vus` and `vus_max`
- **Iterations per second** - Iterations counted per window, divided by the window's length
- **Bandwidth In / Out** - Bytes received and sent, summed per window
- **HTTP Phase Breakdown** - Connecting, TLS handshaking, sending, waiting and receiving times
- **Success Rate** - Share of requests that did not fail, over the selected range
- **Total Throughput** - Bytes received plus bytes sent, one value
- **Avg Iteration Duration**
- **Peak VUs Utilization** - Highest `vus` divided by highest `vus_max`, as a percentage; "No data" when the range holds no k6 run
- **Request Blocked Time** and **Iteration Duration**
- **Response Time Percentiles** and the percentile stats p50 to p99

**Best for:**
- Performance optimization
- Identifying tail latency issues
- Deep troubleshooting

---

#### 3. K6 Load Testing - Pro Dashboard

**UID:** `k6-pro`  
**URL:** http://localhost:3000/d/k6-pro  
**Refresh:** 5 seconds

**Panels:**
- Request Latency (Mean)
- Requests Per Second (RPS) - Requests counted per window, divided by the window's length in seconds
- Error Rate (%)
- Active Virtual Users
- Iterations per second
- Bandwidth In and Bandwidth Out - Bytes summed per window, in separate panels
- HTTP Request Breakdown - Time spent in each phase of a request
- Success Rate, Total Throughput, Avg Iteration Duration
- Response Time Percentiles and the percentile stats p50 to p99

**Best for:**
- Performance testing reports
- Detailed analysis
- Capacity planning

---

### Artillery Dashboards

**Integration:** Artillery (publish-metrics) → StatsD → Telegraf → InfluxDB v2 → Grafana. The measurements and fields are described in [ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md#resulting-schema).

Artillery reports every 10 seconds and Telegraf flushes every 10 seconds, so the Artillery panels trail a run by up to about 20 seconds. Panels that chart over time use a minimum interval of 10 seconds, Artillery's report period. Requests per second come from the `http_requests` counter, summed per window and divided by the window's length; latency panels read the overall series of `artillery_http_response_time` (the one without a `class` tag).

#### 4. Artillery + Telegraf - War Room (Basic)

**UID:** `artillery-telegraf`  
**URL:** http://localhost:3000/d/artillery-telegraf  
**Refresh:** 5 seconds

**Panels:**
- Artillery Test Activity (Last 5min) - Requests sent in the last 5 minutes
- Requests Per Second (RPS)
- Response Latency - Mean response time of each period
- Current RPS (gauge) - Artillery's latest `http_request_rate` in the last minute
- Total Requests - Exact total in the selected range
- Recent Metrics (Last 5min) - Latest request rate, median, p95 and p99, and responses per status code
- Response Time Percentiles (p50, p75, p90, p95, p99) - Each period's percentiles over time
- p50, p75, p90, p95 and p99, worst report - See [Reading the "worst report" stats](#reading-the-worst-report-stats)

**Best for:**
- Watching an Artillery run
- Request rate and totals at a glance

---

#### 5. Artillery Elite Load & Stress War Room

**UID:** `artillery-elite`  
**URL:** http://localhost:3000/d/artillery-elite  
**Refresh:** 5 seconds

**Panels:**
- Latency (Artillery p99) - Each period's p99
- Latency Heatmap - Built from each period's p50, p75, p90, p95 and p99
- Requests Per Second
- HTTP Response Codes - Responses per status code, per window
- Scenario Duration - Median and p95 of the time virtual users took to finish their scenario
- Scenario Counts - Virtual users created, completed and failed
- Total Requests (stat)
- Avg Latency (stat) - Mean response time of the run: each period's mean weighted by its number of responses
- Avg RPS (stat) - Mean of Artillery's `http_request_rate`
- Success Rate (stat) - Share of 2xx responses among all status codes
- Scenario Success Rate (stat) - Completed virtual users divided by completed plus failed
- Avg Scenario Duration (stat)
- HTTP Status Code Distribution - Total responses per status code
- Request Rate Trend - Requests per second, moving average over 5 windows
- Response Time Percentiles and the "worst report" stats

**Best for:**
- Scenario-based tests with several phases
- Error and status code analysis

---

#### 6. Artillery Load Testing - Pro Dashboard

**UID:** `artillery-pro`  
**URL:** http://localhost:3000/d/artillery-pro  
**Refresh:** 5 seconds

**Panels:**
- Latency - Each period's median, p95 and p99
- Request Rate (RPS)
- HTTP Response Codes
- Scenarios Completed - Virtual users that completed their scenario, per window
- Scenario Throughput - Virtual users started per scenario name, per window
- Scenario Duration - Median and p95
- Total Requests (stat)
- Success Rate (stat) - Share of 2xx responses among all status codes
- Avg Scenario Duration (stat)
- Throughput (req/min) (stat) - Mean of Artillery's `http_request_rate`, times 60
- Response Time Percentiles and the "worst report" stats

**Best for:**
- Scenario completion tracking
- Throughput analysis

---

### Reading the "worst report" stats

Artillery sends percentiles already computed for each 10-second period, not one sample per request. Percentiles of different periods cannot be combined into the percentile of the whole run, so the Artillery percentile stats are titled **"p50, worst report"** to **"p99, worst report"**: each shows the highest value among the periods in the selected range.

That value is an upper bound on the run's percentile: if no period had a p95 above 120 ms, the run's p95 is not above 120 ms either. The exact percentile for the whole run is in the summary Artillery prints at the end of the test. The k6 percentile stats do not have this limit, because k6 stores every request's duration.

---

## Accessing Dashboards

### 1. Login to Grafana

```bash
# Open Grafana (GRAFANA_PORT in .env, 3000 by default)
open http://localhost:3000

# Default credentials (GRAFANA_USER and GRAFANA_PASSWORD in .env)
Username: admin
Password: admin123
```

### 2. Navigate to Dashboards

**Method 1: Dashboard menu**
1. Click "Dashboards" in the left menu
2. The six built-in dashboards are in the General folder; dashboards linked with `ltlab dashboard link` are in a folder named "custom"
3. Select a dashboard

**Method 2: Direct URLs**
```bash
# k6 Dashboards
open http://localhost:3000/d/k6-dashboard
open http://localhost:3000/d/k6-elite
open http://localhost:3000/d/k6-pro

# Artillery Dashboards
open http://localhost:3000/d/artillery-telegraf
open http://localhost:3000/d/artillery-elite
open http://localhost:3000/d/artillery-pro
```

### 3. Adjust Time Range

- Click the time picker (top right)
- The default is "Last 30 minutes"; "Last 15 minutes" or "Last 1 hour" are common
- Or set a custom range that covers your run

### 4. Refresh Dashboard

- Dashboards refresh automatically every 5 seconds
- Or click the refresh icon (top right)

---

## Dashboard Architecture

### How It Works

```
┌──────────────┐
│   k6 Test    │──── xk6-output-influxdb (HTTP) ──────────────┐
│   Run        │                                               │
└──────────────┘                                               │
                                                               ▼
┌──────────────┐                                       ┌───────────────┐
│  Artillery   │── StatsD (UDP 8125) ──► Telegraf ────►│  InfluxDB v2  │
│    Test      │                                       │ (bucket from  │
└──────────────┘                                       │ INFLUXDB_     │
                                                       │ BUCKET)       │
                                                       └───────┬───────┘
                                                               │ Flux queries
                                                               ▼
                                                       ┌───────────────┐
                                                       │    Grafana    │
                                                       │  Dashboards   │
                                                       └───────────────┘
```

### Components

1. **Metrics Source**: k6 writes to InfluxDB directly; Artillery sends StatsD to Telegraf, which writes to InfluxDB
2. **Storage**: InfluxDB stores the time series in the bucket named by `INFLUXDB_BUCKET` (default `loadtests`)
3. **Visualization**: Grafana queries and displays them

### Auto-Provisioning

Grafana reads its dashboards from files, through `grafana/provisioning/dashboards/dashboards.yaml`:

```yaml
apiVersion: 1

providers:
  - name: "Load Testing Lab"
    orgId: 1
    type: file
    disableDeletion: false
    editable: true
    updateIntervalSeconds: 10
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true
```

- `grafana/dashboards/` is mounted at `/var/lib/grafana/dashboards`
- Grafana rescans it every 10 seconds, so a new, changed or removed JSON file shows up without a restart
- With `foldersFromFilesStructure`, files at the top level go to the General folder and files in `custom/` (where `ltlab dashboard link` copies a project's dashboards) go to a folder named "custom"

The InfluxDB datasource comes from `grafana/provisioning/datasources/influxdb.yaml`: uid `influxdb`, Flux, with the organization, default bucket and token that Grafana reads from its environment (`INFLUXDB_ORG`, `INFLUXDB_BUCKET`, `INFLUXDB_TOKEN`, passed by Compose from `.env`).

Grafana keeps no state of its own: it has no volume, and its admin user and password come from `.env` on every start. A change made only in the Grafana UI is lost when the lab stops or restarts; see [Customizing Dashboards](#customizing-dashboards) to keep it.

---

## Key Metrics Explained

### Response Time Metrics

#### Average (Mean)
```
avg(http_req_duration)
```
- Average response time across all requests
- Good for general trends
- Can hide outliers

#### Median (p50)
```
percentile(http_req_duration, 50)
```
- 50% of requests faster than this
- Better representation than average
- Less affected by outliers

#### p95 (95th Percentile)
```
percentile(http_req_duration, 95)
```
- 95% of requests faster than this
- Common basis for SLAs
- Captures tail latency

#### p99 (99th Percentile)
```
percentile(http_req_duration, 99)
```
- 99% of requests faster than this
- Shows the slow tail that 1 request in 100 reaches
- Matters for user experience

**What's good?** (the thresholds of `toy-fast.js` and `toy-fast.yml`)
- ✅ p95 < 500ms (half second)
- ✅ p99 < 1000ms (1 second)
- ⚠️ p99 > 2000ms (investigate)

For Artillery, remember that the percentile stats are per-period upper bounds ([Reading the "worst report" stats](#reading-the-worst-report-stats)).

---

### Throughput Metrics

#### Requests Per Second (RPS)
```
k6:        count(http_reqs) per window / window length in seconds
Artillery: sum(http_requests) per window / window length in seconds
```
- Number of requests sent per second
- Measures system capacity
- Higher is generally better

**Typical values:**
- Small API: 10-100 RPS
- Medium API: 100-1000 RPS
- Large API: 1000+ RPS

#### Virtual Users (VUs)
```
gauge(vus)
```
- Concurrent users generating load
- Correlates with RPS
- More VUs = more load

---

### Error Metrics

#### Error Rate (%)
```
(failed_requests / total_requests) × 100
```
- Percentage of failed requests
- For k6, `http_req_failed` counts a response outside 200-399 as failed (k6's default)
- For Artillery, the Success Rate stats show the share of 2xx responses among all status codes

**Thresholds:**
- ✅ < 0.1% - Excellent
- ⚠️ 0.1% - 1% - Acceptable
- ❌ > 1% - Investigate
- 🔥 > 5% - Critical

#### HTTP Status Codes
- **2xx**: Success (200, 201, 204)
- **4xx**: Client errors (400, 401, 404)
- **5xx**: Server errors (500, 502, 503)

---

### Bandwidth Metrics

#### Data Received
```
sum(data_received)
```
- Bytes downloaded from the server
- Response payload size

#### Data Sent
```
sum(data_sent)
```
- Bytes uploaded to the server
- Request payload size

The k6 bandwidth panels sum these per window; Total Throughput adds both over the selected range.

---

## Customizing Dashboards

### Why Customize?

The pre-built dashboards cover standard metrics, but you may need:
- Domain-specific business metrics
- Custom API response fields
- Application-specific timings
- Resource consumption tracking

### Creating Custom Panels

**1. Edit Dashboard**
- Open a dashboard
- Click "Add" > "Visualization" (top bar)

**2. Choose Visualization**
- Time series (line chart)
- Gauge (single value)
- Stat (big number)
- Table (data grid)
- Heatmap (distribution)

**3. Write Flux Query**

Use the datasource's bucket (`v.defaultBucket`) rather than a bucket name, as the built-in panels do. Example - Average response time:
```flux
from(bucket: v.defaultBucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)
```

For Artillery queries, see the examples in [ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md#example-flux-queries).

**4. Configure Panel**
- Set title
- Choose colors
- Add thresholds
- Format units (ms, %, bytes)

**5. Keep the Change in a File**

Grafana keeps no state, so a dashboard saved only in the UI is gone after `ltlab stop` and `ltlab start`, or `ltlab restart`. To keep it:
- Copy the dashboard's JSON (Dashboard settings > JSON Model)
- Save it over the dashboard's file in `grafana/dashboards/`, or in your project's dashboards folder and run `ltlab dashboard link <dir>` (see [EXTERNAL_PROJECTS.md](EXTERNAL_PROJECTS.md#custom-grafana-dashboards))
- Grafana picks up the file within 10 seconds, without a restart

A new dashboard needs its own `uid` and `title`: Grafana does not load two dashboards with the same uid, so a copy of a built-in dashboard must get a new uid.

---

## Custom Metrics

### Adding Custom Metrics in k6

Track domain-specific data from API responses:

**Example: LLM Token Count**
```javascript
import http from 'k6/http';
import { Trend } from 'k6/metrics';

const tokenCount = new Trend('llm_token_count');

export default function () {
  const res = http.post(`${__ENV.TARGET_API_URL}/completions`, JSON.stringify({
    prompt: 'Hello',
    max_tokens: 100
  }));
  
  const data = JSON.parse(res.body);
  tokenCount.add(data.usage.total_tokens);
}
```

**Example: Custom Timing**
```javascript
import { Trend } from 'k6/metrics';

const cacheLatency = new Trend('cache_lookup_time');

export default function () {
  const start = Date.now();
  // Cache lookup logic
  const duration = Date.now() - start;
  cacheLatency.add(duration);
}
```

### Visualizing Custom Metrics

Every k6 metric, custom ones included, reaches InfluxDB as a measurement named after the metric, with its samples in the field `value`.

**Flux query for custom metric:**
```flux
from(bucket: v.defaultBucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "llm_token_count")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)
```

---

## Troubleshooting Dashboards

### No Data Showing

**1. Check time range**
- Adjust to "Last 15 minutes" or "Last 1 hour"
- Ensure the time range covers when the test ran
- Artillery panels trail a run by up to about 20 seconds

**2. Verify the test sent data**
```bash
# k6 prints this at the start of every run when it sends metrics:
#   ✅ K6 InfluxDB configured:
# If it prints a WARNING instead, INFLUXDB_TOKEN is missing from the lab's .env:
ltlab configure

# Check that the token in .env is accepted by InfluxDB
npm run check-influx
```

An Artillery scenario sends metrics only if its `config` has the `publish-metrics` block ([ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md#step-1-artillery-sends-its-metrics)).

**3. Check datasource**
- Go to Connections > Data sources
- Click "InfluxDB"
- Click the "Test" button
- It should report that the data source is working

---

### Panels Show "No Data"

**1. Check measurement exists**
```bash
# Last rows written in the past hour, read with the lab's .env
npm run tail-influx

# Or query InfluxDB directly, from the lab's root directory
set -a; . ./.env; set +a
curl -s "http://localhost:${INFLUXDB_PORT_EXPORT:-8086}/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d "from(bucket: \"${INFLUXDB_BUCKET:-loadtests}\") |> range(start: -1h) |> limit(n:10)"
```

**2. Verify Flux query syntax**
- Edit panel
- Check query for errors
- Test with simple query first

**3. Expected empty panels**
- Peak VUs Utilization shows "No data" when the range holds no k6 run
- The k6 dashboards stay empty after an Artillery run, and the Artillery dashboards after a k6 run

---

### Dashboard Not Auto-Loading

**Check provisioning:**
```bash
# Verify files exist (built-in and linked)
ltlab dashboard list

# Check Grafana logs, from the lab's root directory
docker compose logs grafana | grep -i provision
```

**Common causes:**
- The file is not a dashboard's JSON model (Dashboard settings > JSON Model)
- Two dashboards share a `uid`; give each its own
- The file is in a subfolder of your project's dashboards folder: `ltlab dashboard link <dir>` copies only the `.json` files at the top of `<dir>`

---

## Next Steps

- **[USAGE.md](USAGE.md)** - Run tests to generate metrics
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Fix dashboard issues
- **[ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md)** - How Artillery's metrics reach InfluxDB
- **[Blog: Metrics Deep Dive](https://destbreso.com/blog/reading-load-test-metrics)** - Understanding metrics and monitoring
- **[Blog: Dashboard Customization](https://destbreso.com/blog/load-testing-lab-custom-metrics-and-dashboards)** - Custom metrics and advanced panels
- **[Grafana Docs](https://grafana.com/docs/)** - Official documentation
- **[Flux Language](https://docs.influxdata.com/flux/)** - Query language guide
