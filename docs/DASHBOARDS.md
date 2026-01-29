# Dashboards Guide

Complete guide to Grafana dashboards for load testing visualization.

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

The Load Testing Lab includes **6 professional Grafana dashboards** (3 for k6, 3 for Artillery) that visualize real-time metrics from your load tests.

### Features

✅ **Auto-provisioned** - Load automatically on Grafana startup  
✅ **Real-time updates** - Refresh every 3-5 seconds  
✅ **Zero configuration** - Work out of the box  
✅ **Professional layouts** - Three tiers: Basic, Pro, Elite  
✅ **Flux queries** - InfluxDB v2 compatible  

### Dashboard Tiers

- **Basic (War Room)**: Quick overview for incident response
- **Pro**: Professional analysis with detailed breakdowns
- **Elite**: Advanced metrics including heatmaps and percentiles

---

## Available Dashboards

### k6 Dashboards

#### 1. k6 Load Testing - War Room (Basic)

**UID:** `k6-dashboard`  
**URL:** http://localhost:3000/d/k6-dashboard  
**Refresh:** 5 seconds

**Panels:**
- HTTP Request Duration (average)
- Virtual Users (current)
- Total HTTP Requests
- Total Iterations
- Top 10 Slowest Endpoints

**Best for:**
- Quick health checks
- Smoke tests
- Initial test runs
- Real-time monitoring during incidents

---

#### 2. K6 Elite Performance War Room

**UID:** `k6-elite`  
**URL:** http://localhost:3000/d/k6-elite  
**Refresh:** 3 seconds

**Panels:**
- **Latency Percentiles** (p50, p95, p99) - Deep latency analysis
- **Latency Heatmap** - Visual latency distribution
- **Requests Per Second** - Throughput trends
- **Error Rate (%)** - Failure tracking
- **Virtual Users** - Load progression
- **Iterations** - Test execution count
- **Bandwidth In/Out** - Network usage (separate panels)
- **HTTP Phase Breakdown** - Connection, TLS, waiting, receiving phases

**Best for:**
- Production incident response
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
- Requests Per Second (RPS)
- Error Rate (%)
- Active Virtual Users
- Iterations
- Bandwidth In (separate panel)
- Bandwidth Out (separate panel)
- HTTP Request Breakdown (by phase)

**Best for:**
- Professional load testing
- Performance testing reports
- Detailed analysis
- Capacity planning

---

### Artillery Dashboards

#### 4. Artillery + Telegraf - War Room (Basic)

**UID:** `artillery-telegraf`  
**URL:** http://localhost:3000/d/artillery-telegraf  
**Refresh:** 5 seconds

**Integration:** Artillery → Telegraf (StatsD) → InfluxDB v2 → Grafana

**Panels:**
- Test Activity
- Response Latency
- Requests Per Second
- Current RPS (gauge)
- Total Requests
- Recent Metrics Table

**Best for:**
- Quick Artillery test monitoring
- YAML-based scenario testing
- Real-time RPS tracking

---

#### 5. Artillery Elite Load & Stress War Room

**UID:** `artillery-elite`  
**URL:** http://localhost:3000/d/artillery-elite  
**Refresh:** 3 seconds

**Panels:**
- Latency (p99 approximation)
- Latency Heatmap
- Requests Per Second
- HTTP Response Codes (200, 4xx, 5xx)
- Scenario Duration
- Scenario Counts
- Total Requests (stat)
- Avg Latency (stat)
- Avg RPS (stat)

**Best for:**
- Complex scenario-based testing
- Multi-phase load tests
- Advanced Artillery metrics

---

#### 6. Artillery Load Testing - Pro Dashboard

**UID:** `artillery-pro`  
**URL:** http://localhost:3000/d/artillery-pro  
**Refresh:** 5 seconds

**Panels:**
- Latency
- Request Rate (RPS)
- HTTP Response Codes
- Scenarios Completed
- Scenario Throughput
- Scenario Duration
- Total Requests (stat)

**Best for:**
- Professional Artillery testing
- Scenario completion tracking
- Throughput analysis

---

## Accessing Dashboards

### 1. Login to Grafana

```bash
# Open Grafana
open http://localhost:3000

# Default credentials
Username: admin
Password: admin123
```

### 2. Navigate to Dashboards

**Method 1: Dashboard menu**
1. Click "Dashboards" in left sidebar
2. Click "Browse"
3. Select dashboard from list

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

- Click time picker (top right)
- Common ranges: "Last 15 minutes", "Last 1 hour"
- Or set custom range

### 4. Refresh Dashboard

- Click refresh icon (top right)
- Or auto-refresh: dashboards refresh automatically every 3-5 seconds

---

## Dashboard Architecture

### How It Works

```
┌──────────────┐
│   k6 Test    │────┐
│   Run        │    │
└──────────────┘    │
                    │ xk6-influxdb
┌──────────────┐    │
│ Artillery    │────┤
│   Test       │    │ Telegraf
└──────────────┘    │
                    ▼
             ┌──────────────┐
             │  InfluxDB v2  │
             │  (loadtests)  │
             └───────┬───────┘
                     │ Flux Queries
                     ▼
             ┌──────────────┐
             │   Grafana    │
             │  Dashboards  │
             └──────────────┘
```

### Components

1. **Metrics Source**: k6 or Artillery send metrics
2. **Storage**: InfluxDB stores time-series data
3. **Visualization**: Grafana queries and displays

### Auto-Provisioning

Dashboards are provisioned automatically via:

```yaml
# grafana/provisioning/dashboards/dashboards.yaml
apiVersion: 1
providers:
  - name: 'default'
    folder: ''
    type: file
    options:
      path: /etc/grafana/dashboards
```

Dashboard JSON files in `grafana/dashboards/` load on startup.

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
- Industry standard for SLAs
- Captures tail latency

#### p99 (99th Percentile)
```
percentile(http_req_duration, 99)
```
- 99% of requests faster than this
- Identifies worst-case scenarios
- Critical for user experience

**What's good?**
- ✅ p95 < 500ms (half second)
- ✅ p99 < 1000ms (1 second)
- ⚠️ p99 > 2000ms (investigate)

---

### Throughput Metrics

#### Requests Per Second (RPS)
```
count(http_reqs) / time_window
```
- Number of requests completed per second
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
- HTTP status >= 400 counts as error

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
- Bytes downloaded from server
- Response payload size
- Network egress

#### Data Sent
```
sum(data_sent)
```
- Bytes uploaded to server
- Request payload size
- Network ingress

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
- Open dashboard
- Click "⚙️ Settings" (top right)
- Click "Make editable"
- Click "Add panel"

**2. Choose Visualization**
- Time series (line chart)
- Gauge (single value)
- Stat (big number)
- Table (data grid)
- Heatmap (distribution)

**3. Write Flux Query**

Example - Average response time:
```flux
from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)
```

**4. Configure Panel**
- Set title
- Choose colors
- Add thresholds
- Format units (ms, %, bytes)

**5. Save Dashboard**

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
  const res = http.post('https://api.openai.com/v1/completions', JSON.stringify({
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

Custom metrics automatically appear in InfluxDB with measurement name matching your metric name.

**Flux query for custom metric:**
```flux
from(bucket: "loadtests")
  |> range(start: v.timeRangeStart)
  |> filter(fn: (r) => r["_measurement"] == "llm_token_count")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: v.windowPeriod, fn: mean)
```

---

## Troubleshooting Dashboards

### No Data Showing

**1. Check time range**
- Adjust to "Last 15 minutes" or "Last 1 hour"
- Ensure time range covers when test ran

**2. Verify test sent data**
```bash
# k6 should show:
# output: InfluxDBv2 (http://influxdb:8086)

# Check token
node scripts/check-influx-token.js
```

**3. Check datasource**
- Go to Configuration → Data Sources
- Click "InfluxDB"
- Click "Test" button
- Should show: "Data source is working"

---

### Panels Show "No Data"

**1. Check measurement exists**
```bash
# Query InfluxDB directly
curl -X POST "http://localhost:8086/api/v2/query?org=myorg" \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests") |> range(start: -1h) |> limit(n:10)'
```

**2. Verify Flux query syntax**
- Edit panel
- Check query for errors
- Test with simple query first

---

### Dashboard Not Auto-Loading

**Check provisioning:**
```bash
# Verify files exist
ls grafana/dashboards/
ls grafana/provisioning/dashboards/

# Check Grafana logs
docker-compose logs grafana | grep -i provision
```

**Manually import:**
1. Go to Dashboards → Import
2. Upload JSON file from `grafana/dashboards/`
3. Select InfluxDB datasource

---

## Next Steps

- **[USAGE.md](USAGE.md)** - Run tests to generate metrics
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Fix dashboard issues
- **[Blog: Metrics Deep Dive](../blog/advanced/art4.md)** - Understanding metrics and monitoring
- **[Blog: Dashboard Customization](../blog/advanced/art10-dashboard-customization.md)** - Custom metrics and advanced panels
- **[Grafana Docs](https://grafana.com/docs/)** - Official documentation
- **[Flux Language](https://docs.influxdata.com/flux/)** - Query language guide

---

**Last Updated:** January 29, 2026
