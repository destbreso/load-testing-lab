# **Load Testing Lab Architecture Deep Dive – Understanding the Stack**

**Part of:** [Load Testing Lab Series](art0.md) | **Previous:** [← Basic Series](../basic/art3.md) | **Next:** [Quickstart Deep Dive →](art2.md)

**Estimated reading time:** 15–18 minutes

---

> 💡 **About this article:** This is an **architecture-focused deep dive** that builds on the [basic introduction](../basic/art1.md). If you're completely new to Load Testing Lab, **start with the [Basic Series](../basic/art1.md) first**. This article assumes you understand why load testing matters and have basic familiarity with the lab components.

## **Prerequisites**

Before reading this article, you should have:
- ✅ Read [Basic Article 1](../basic/art1.md) - Introduction
- ✅ Basic understanding of Docker and containerization  
- ✅ Familiarity with time-series databases (helpful but not required)
- ✅ Ran at least one test in the lab (from [Basic Article 2](../basic/art2.md))

---

## **What Makes This Article Different**

In the basic introduction, we focused on **why** the lab exists and **what problems it solves**. Now we'll dive into:

* **How the architecture works** at a technical level
* **Why specific design decisions** were made
* **Trade-offs and alternatives** considered
* **Extension points** for customization
* **Performance characteristics** of each component
* **Production considerations** for real-world use

This is the technical foundation you need to **customize, extend, and optimize** the lab for your specific needs.

---

## **Architecture Philosophy**

The Load Testing Lab follows three core principles:

### 1. **Separation of Concerns**

Each component has a single, well-defined responsibility:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Load Gen    │────▶│   Metrics    │────▶│  Storage     │────▶│  Viz Layer   │
│  (k6/Art)    │     │  (StatsD)    │     │  (InfluxDB)  │     │  (Grafana)   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

**Why this matters:**
- You can swap k6 for Artillery (or add Locust, JMeter, etc.)
- InfluxDB can be replaced with Prometheus, Elasticsearch, etc.
- Grafana can be replaced with Kibana, custom dashboards, etc.
- Each component fails independently without bringing down the stack

### 2. **Developer Experience First**

The lab prioritizes **immediate productivity** over configuration flexibility:

**Design choices:**
- **Sensible defaults** - Works without `.env` file
- **Pre-built dashboards** - No manual setup required
- **Auto-provisioning** - Grafana datasources configured automatically
- **Professional CLI** - No Docker command memorization
- **Toy API included** - No external dependencies for testing

**Traditional load testing setup:**
```bash
# Install k6
brew install k6

# Install InfluxDB
docker run -d influxdb

# Configure InfluxDB
influx setup --org myorg --bucket loadtests --username admin --password admin123

# Get token
influx auth list

# Configure k6 output
export K6_OUT=influxdb=http://localhost:8086/api/v2/write?org=myorg&bucket=loadtests
export K6_INFLUXDB_TOKEN=your-token-here

# Install Grafana
docker run -d grafana

# Configure datasource manually in UI
# Import dashboards manually
# ...takes 30+ minutes
```

**Load Testing Lab:**
```bash
git clone https://github.com/destbreso/load-testing-lab.git
docker-compose up -d
ltlab k6 -s toy-fast.js
# Visit http://localhost:3081 - everything works ✨
```

### 3. **Production-Ready Patterns**

While designed for local testing, the lab uses **patterns that scale to production:**

- Time-series database (InfluxDB) - used by Uber, Cisco, IBM
- StatsD protocol - industry standard for metrics aggregation
- Docker Compose - easily translates to Kubernetes
- Infrastructure as Code - everything version-controlled
- CLI-driven operations - scriptable and automatable

---

## **Component Architecture**

### **k6 + xk6-influxdb Extension**

**Why k6?**
- Modern JavaScript API (familiar to web developers)
- Built in Go (high performance, low resource usage)
- Native HTTP/2, WebSocket, gRPC support
- Rich ecosystem of extensions via xk6

**Why custom build with xk6-influxdb?**

Standard k6 doesn't support InfluxDB v2 out of the box. The extension provides:

```dockerfile
# k6/Dockerfile
FROM golang:1.21-alpine AS builder
RUN go install go.k6.io/xk6/cmd/xk6@latest
RUN xk6 build --with github.com/grafana/xk6-output-influxdb

FROM alpine:latest
COPY --from=builder /go/k6 /usr/bin/k6
```

**What this gives us:**
- Direct InfluxDB v2 API writes (no v1 compatibility mode)
- Automatic metric tagging with test metadata
- Batch writes for efficiency (reduces overhead)
- Minimal latency impact on test execution

**Metrics flow:**

```
┌─────────────────────────────────────────────────────────┐
│                     k6 Test Script                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ HTTP Request │  │ Check Result │  │  Custom Tag  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘          │
│                            │                             │
│                    ┌───────▼───────┐                     │
│                    │ xk6-influxdb  │                     │
│                    │   Extension   │                     │
│                    └───────┬───────┘                     │
└────────────────────────────┼─────────────────────────────┘
                             │
                             │ Line Protocol
                             │ (Batched writes every 1s)
                             ▼
                    ┌────────────────┐
                    │   InfluxDB v2  │
                    │   Write API    │
                    └────────────────┘
```

**Performance characteristics:**
- **Memory**: ~50MB per VU (virtual user)
- **CPU**: Minimal (Go's excellent concurrency)
- **Network**: ~100 req/s per VU (depends on target API)
- **Metrics overhead**: <1% latency impact

**Trade-offs:**
- ✅ Pro: Native InfluxDB v2 support
- ✅ Pro: Efficient batch writes
- ❌ Con: Custom Docker image (slight build complexity)
- ❌ Con: Extension updates lag behind k6 releases

---

### **Artillery + Telegraf + StatsD**

**Why Artillery?**
- YAML-based configuration (no coding required)
- Built-in scenarios for common patterns
- Artillery Pro features (distributed testing, cloud execution)
- Strong focus on observability

**Why the Telegraf layer?**

Artillery outputs to StatsD, but InfluxDB v2 doesn't natively support StatsD. Telegraf bridges the gap:

```
┌────────────────────────────────────────────────────────┐
│                   Artillery Test                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Request    │  │   Latency    │  │    Error     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │         │
│         └──────────────────┴──────────────────┘         │
│                            │                            │
│                    ┌───────▼───────┐                    │
│                    │  StatsD UDP   │                    │
│                    │  Port 8125    │                    │
│                    └───────┬───────┘                    │
└────────────────────────────┼────────────────────────────┘
                             │
                             │ StatsD Protocol
                             │ (UDP datagrams)
                             ▼
                    ┌────────────────┐
                    │    Telegraf    │
                    │  StatsD Input  │
                    │ InfluxDB Output│
                    └────────┬───────┘
                             │
                             │ Line Protocol
                             │ (Batched HTTP writes)
                             ▼
                    ┌────────────────┐
                    │   InfluxDB v2  │
                    │   Write API    │
                    └────────────────┘
```

**Telegraf configuration highlights:**

```toml
# telegraf/telegraf.conf
[[inputs.statsd]]
  service_address = ":8125"
  metric_separator = "."
  
  # Artillery sends metrics as:
  # artillery.response_time:234|ms
  # artillery.requests:1|c
  
  # Telegraf converts to InfluxDB line protocol:
  # artillery,metric=response_time value=234 timestamp
  # artillery,metric=requests value=1 timestamp

[[outputs.influxdb_v2]]
  urls = ["http://influxdb:8086"]
  token = "${INFLUXDB_TOKEN}"
  organization = "${INFLUXDB_ORG}"
  bucket = "${INFLUXDB_BUCKET}"
  
  # Batch writes for efficiency
  flush_interval = "1s"
  metric_batch_size = 1000
```

**Performance characteristics:**
- **Memory**: ~30MB per Artillery worker
- **CPU**: Higher than k6 (Node.js vs Go)
- **Network**: UDP overhead minimal
- **Metrics overhead**: ~2% latency impact (UDP + Telegraf processing)

**Trade-offs:**
- ✅ Pro: YAML configuration (easier for non-developers)
- ✅ Pro: StatsD flexibility (many tools support it)
- ❌ Con: Extra hop (Artillery → Telegraf → InfluxDB)
- ❌ Con: UDP = potential packet loss (usually < 0.1%)

---

### **InfluxDB v2 - Time-Series Database**

**Why InfluxDB?**
- Purpose-built for time-series data (optimized storage/queries)
- Built-in downsampling and retention policies
- Powerful query language (Flux)
- Excellent compression (10:1 typical ratio)

**Why v2 specifically?**
- Unified API (no separate Chronograf, Kapacitor)
- Token-based authentication (better security)
- Modern query language with better performance
- Active development and community

**Data model:**

```
measurement = "http_reqs"
├── tags (indexed, used for grouping)
│   ├── status = "200"
│   ├── method = "GET"
│   ├── scenario = "toy-fast"
│   └── url = "http://toy-api:3000/fast"
└── fields (not indexed, actual values)
    ├── value = 1 (counter)
    ├── duration = 45.2 (milliseconds)
    └── check_failure = 0 (boolean as int)

timestamp = 1704067200000000000 (nanoseconds)
```

**Storage architecture:**

```
┌─────────────────────────────────────────────────┐
│              InfluxDB v2 Storage                │
│                                                 │
│  ┌──────────────┐        ┌──────────────┐      │
│  │    Write     │        │     Read     │      │
│  │   API Layer  │        │  API Layer   │      │
│  └──────┬───────┘        └──────▲───────┘      │
│         │                       │              │
│         │                       │              │
│  ┌──────▼───────────────────────┴───────┐      │
│  │          Storage Engine              │      │
│  │  ┌────────────────────────────────┐  │      │
│  │  │  TSM (Time-Structured Merge)   │  │      │
│  │  │  - Columnar format             │  │      │
│  │  │  - Heavy compression           │  │      │
│  │  │  - Fast aggregations           │  │      │
│  │  └────────────────────────────────┘  │      │
│  └───────────────────────────────────────┘      │
│                                                 │
│  Data Flow:                                     │
│  1. Write → WAL (Write-Ahead Log)               │
│  2. WAL → In-Memory Cache                       │
│  3. Cache → TSM Files (every ~1min)             │
│  4. Old TSM Files → Compaction (background)     │
└─────────────────────────────────────────────────┘
```

**Performance characteristics:**
- **Write throughput**: 250,000+ points/sec (single node)
- **Query latency**: <100ms for simple aggregations
- **Compression ratio**: 10:1 typical, 90:1 possible
- **Disk I/O**: Write-optimized (append-only TSM files)

**Retention and downsampling:**

```flux
// Automatically delete data older than 30 days
option task = {
  name: "downsample-30d",
  every: 1h,
}

from(bucket: "loadtests")
  |> range(start: -30d)
  |> aggregateWindow(every: 1m, fn: mean)
  |> to(bucket: "loadtests-downsampled")
```

**Trade-offs:**
- ✅ Pro: Excellent compression and query performance
- ✅ Pro: Purpose-built for metrics data
- ✅ Pro: Active development and community
- ❌ Con: Higher memory usage than Prometheus
- ❌ Con: Flux query language has learning curve
- ❌ Con: v2 less mature than v1 (some tooling gaps)

---

### **Grafana - Visualization Layer**

**Why Grafana?**
- De facto standard for metrics visualization
- Rich dashboard ecosystem
- Support for 50+ data sources
- Powerful query builder and templating

**Auto-provisioning architecture:**

```
grafana/
├── dashboards/                    # Dashboard JSON files
│   ├── k6-dashboard.json
│   ├── artillery-dashboard.json
│   └── ...
└── provisioning/
    ├── dashboards/
    │   └── dashboard.yml          # Tells Grafana where to find dashboards
    └── datasources/
        └── influxdb.yml           # Auto-configures InfluxDB connection
```

**Example datasource provisioning:**

```yaml
# grafana/provisioning/datasources/influxdb.yml
apiVersion: 1

datasources:
  - name: InfluxDB
    type: influxdb
    access: proxy
    url: http://influxdb:8086
    jsonData:
      version: Flux
      organization: ${INFLUXDB_ORG}
      defaultBucket: ${INFLUXDB_BUCKET}
      tlsSkipVerify: true
    secureJsonData:
      token: ${INFLUXDB_TOKEN}
```

**What happens on startup:**

```
1. Grafana container starts
2. Reads provisioning/ directory
3. Creates datasource "InfluxDB" automatically
4. Loads all dashboards from dashboards/
5. User visits http://localhost:3081
6. Dashboards are already configured and working ✨
```

**Dashboard architecture:**

Each dashboard uses:
- **Variables** for dynamic filtering (scenario, status code, etc.)
- **Panels** for different visualizations (graphs, stats, tables)
- **Queries** using Flux to aggregate InfluxDB data
- **Alerts** for threshold-based notifications (optional)

**Example panel query:**

```flux
from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: 10s, fn: mean, createEmpty: false)
  |> yield(name: "mean")
```

**Performance characteristics:**
- **Query latency**: Depends on InfluxDB query complexity
- **Refresh rate**: Default 5s (configurable per dashboard)
- **Memory**: ~200MB baseline + ~10MB per active dashboard
- **Concurrent users**: 10-20 without performance impact

**Trade-offs:**
- ✅ Pro: Industry-standard tool with huge ecosystem
- ✅ Pro: Auto-provisioning = zero manual setup
- ✅ Pro: Beautiful, customizable dashboards
- ❌ Con: Can be resource-intensive with many dashboards
- ❌ Con: Flux queries have learning curve
- ❌ Con: Some advanced features require Grafana Enterprise

---

## **System Integration Flow**

### **Complete Request Flow (k6 Example)**

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Developer runs: ltlab k6 -s toy-fast.js                  │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. CLI executes: docker-compose run --rm k6 run ...         │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. k6 container starts, reads scenario from /k6/scenarios/  │
│    - Parses options (VUs, duration, thresholds)             │
│    - Connects to InfluxDB using env vars                     │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. k6 executes test                                          │
│    ┌────────────┐                                            │
│    │  VU 1-50   │ Each VU runs in parallel:                  │
│    │            │ - Makes HTTP request to toy-api            │
│    │ while(true)│ - Measures latency                         │
│    │  request() │ - Runs checks (status code, etc.)          │
│    │  sleep()   │ - Tags metrics (scenario, url, etc.)       │
│    └────────────┘                                            │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. xk6-influxdb extension batches metrics                   │
│    Every 1 second, sends to InfluxDB:                        │
│                                                              │
│    http_reqs,scenario=toy-fast,status=200 value=45 ts       │
│    http_req_duration,scenario=toy-fast,status=200 value=23  │
│    http_req_failed,scenario=toy-fast value=0 ts             │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. InfluxDB receives and stores data                         │
│    - Writes to WAL (durability)                              │
│    - Buffers in memory (performance)                         │
│    - Flushes to TSM files (compression)                      │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. Grafana queries InfluxDB every 5 seconds                  │
│    - Executes Flux queries from dashboard panels             │
│    - Renders graphs, stats, tables                           │
│    - Updates in browser via WebSocket                        │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. Developer sees real-time results at localhost:3081       │
│    - Latency percentiles (p50, p95, p99)                     │
│    - Request rate and error rate                             │
│    - Test progress and remaining time                        │
└──────────────────────────────────────────────────────────────┘
```

---

## **Customization and Extension Points**

### **Adding a New Load Generator (e.g., Locust)**

1. **Create Dockerfile:**

```dockerfile
# locust/Dockerfile
FROM python:3.11-slim

RUN pip install locust influxdb-client

WORKDIR /locust
```

2. **Add to docker-compose.yml:**

```yaml
locust:
  build: ./locust
  volumes:
    - ./locust/scenarios:/locust/scenarios
  environment:
    - INFLUXDB_URL=http://influxdb:8086
    - INFLUXDB_TOKEN=${INFLUXDB_TOKEN}
    - INFLUXDB_ORG=${INFLUXDB_ORG}
    - INFLUXDB_BUCKET=${INFLUXDB_BUCKET}
  networks:
    - loadtest-network
```

3. **Create scenario with InfluxDB integration:**

```python
# locust/scenarios/example.py
from locust import HttpUser, task, between
from influxdb_client import InfluxDBClient, Point
import os

influx_client = InfluxDBClient(
    url=os.environ['INFLUXDB_URL'],
    token=os.environ['INFLUXDB_TOKEN'],
    org=os.environ['INFLUXDB_ORG']
)
write_api = influx_client.write_api()

class LoadTestUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def test_endpoint(self):
        response = self.client.get("/fast")
        
        # Write metrics to InfluxDB
        point = Point("http_reqs") \
            .tag("tool", "locust") \
            .tag("status", response.status_code) \
            .field("duration", response.elapsed.total_seconds() * 1000) \
            .field("value", 1)
        write_api.write(bucket=os.environ['INFLUXDB_BUCKET'], record=point)
```

4. **Add CLI command:**

```javascript
// cli/commands/locust.js
program
  .command('locust')
  .option('-s, --scenario <file>', 'Scenario file')
  .option('-u, --users <number>', 'Number of users', '10')
  .action((options) => {
    execSync(
      `docker-compose run --rm locust -f /locust/scenarios/${options.scenario} -u ${options.users}`,
      { stdio: 'inherit' }
    );
  });
```

### **Adding Custom Metrics**

**In k6:**

```javascript
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const customCounter = new Counter('custom_business_metric');
const customTrend = new Trend('custom_latency');

export default function () {
  const response = http.get('http://toy-api:3000/users');
  
  // Track business logic
  const userData = JSON.parse(response.body);
  customCounter.add(userData.activeUsers);
  customTrend.add(userData.processingTime);
}
```

**In Grafana dashboard:**

```flux
from(bucket: "loadtests")
  |> range(start: v.timeRangeStart)
  |> filter(fn: (r) => r["_measurement"] == "custom_business_metric")
  |> aggregateWindow(every: 1m, fn: sum)
```

### **Integrating Your Own API**

**Option 1: Environment variable (simple):**

```bash
# .env
TARGET_API_URL=http://host.docker.internal:4000
```

```javascript
// k6 scenario
export default function () {
  http.get(`${__ENV.TARGET_API_URL}/api/endpoint`);
}
```

**Option 2: Add to docker-compose network (advanced):**

```yaml
# docker-compose.override.yml
services:
  my-api:
    image: my-company/my-api:latest
    networks:
      - loadtest-network
    environment:
      - DATABASE_URL=postgresql://...
```

```javascript
// k6 scenario
export default function () {
  // Direct container-to-container communication
  http.get('http://my-api:3000/api/endpoint');
}
```

---

## **Performance Tuning**

### **k6 Optimization**

**Problem:** Running out of memory with 1000+ VUs

**Solutions:**

1. **Split into multiple k6 instances:**

```bash
# Run 4 instances of 250 VUs each
ltlab k6 -s scenario.js --vus 250 &
ltlab k6 -s scenario.js --vus 250 &
ltlab k6 -s scenario.js --vus 250 &
ltlab k6 -s scenario.js --vus 250 &
```

2. **Use k6 cloud (distributed execution):**

```javascript
export let options = {
  ext: {
    loadimpact: {
      distribution: {
        'us-east-1': { loadZone: 'amazon:us:ashburn', percent: 50 },
        'eu-west-1': { loadZone: 'amazon:ie:dublin', percent: 50 },
      },
    },
  },
};
```

3. **Optimize script (reduce memory per VU):**

```javascript
// ❌ Bad: Creates new object every iteration
export default function () {
  const headers = { 'Content-Type': 'application/json' };
  http.post(url, JSON.stringify(data), { headers });
}

// ✅ Good: Reuse objects
const headers = { 'Content-Type': 'application/json' };
const params = { headers };

export default function () {
  http.post(url, JSON.stringify(data), params);
}
```

### **InfluxDB Optimization**

**Problem:** Slow queries on large datasets

**Solutions:**

1. **Add indexes on frequently-queried tags:**

InfluxDB automatically indexes tags, so ensure you're using tags (not fields) for filtering:

```flux
// ❌ Slow: Filtering on field
from(bucket: "loadtests")
  |> filter(fn: (r) => r["_field"] == "duration")
  |> filter(fn: (r) => r["_value"] > 1000)  // No index!

// ✅ Fast: Filtering on tag
from(bucket: "loadtests")
  |> filter(fn: (r) => r["status"] == "200")  // Indexed!
  |> filter(fn: (r) => r["_field"] == "duration")
```

2. **Implement downsampling for historical data:**

```flux
// Task runs every hour
option task = {name: "downsample-hourly", every: 1h}

from(bucket: "loadtests")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
  |> aggregateWindow(every: 1m, fn: mean)
  |> to(bucket: "loadtests-hourly")
```

3. **Use retention policies:**

```bash
# Delete data older than 7 days
influx bucket update \
  --name loadtests \
  --retention 168h
```

### **Grafana Optimization**

**Problem:** Dashboards loading slowly

**Solutions:**

1. **Limit time range in queries:**

```flux
// ❌ Slow: Unbounded time range
from(bucket: "loadtests")
  |> range(start: 0)  // Queries ALL data!

// ✅ Fast: Limited time range
from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
```

2. **Use dashboard variables for filtering:**

```flux
// Variable: $scenario
from(bucket: "loadtests")
  |> range(start: v.timeRangeStart)
  |> filter(fn: (r) => r["scenario"] == "${scenario}")
```

3. **Increase refresh interval for historical analysis:**

Dashboard Settings → Time options → Auto refresh: 5s → 30s

---

## **Production Considerations**

### **Security**

**Current setup (development):**
- InfluxDB without TLS
- Grafana without authentication
- All ports exposed

**Production recommendations:**

1. **Enable TLS:**

```yaml
# docker-compose.prod.yml
services:
  influxdb:
    environment:
      - INFLUXDB_HTTP_HTTPS_ENABLED=true
      - INFLUXDB_HTTP_HTTPS_CERTIFICATE=/ssl/cert.pem
    volumes:
      - ./ssl:/ssl:ro
```

2. **Use secrets management:**

```yaml
services:
  influxdb:
    secrets:
      - influxdb_admin_token
      
secrets:
  influxdb_admin_token:
    external: true
```

3. **Enable Grafana authentication:**

```yaml
services:
  grafana:
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=false
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
```

### **High Availability**

**InfluxDB clustering:**

InfluxDB v2 OSS doesn't support clustering. Options:

1. **InfluxDB Enterprise** (commercial)
2. **InfluxDB Cloud** (managed service)
3. **Federation** (multiple independent instances)

**Grafana high availability:**

```yaml
# docker-compose.ha.yml
services:
  grafana-1:
    image: grafana/grafana:latest
    environment:
      - GF_DATABASE_TYPE=postgres
      - GF_DATABASE_HOST=postgres:5432
    networks:
      - loadtest-network
      
  grafana-2:
    image: grafana/grafana:latest
    environment:
      - GF_DATABASE_TYPE=postgres
      - GF_DATABASE_HOST=postgres:5432
    networks:
      - loadtest-network
      
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "3081:80"
    depends_on:
      - grafana-1
      - grafana-2
```

### **Monitoring the Monitoring**

**Add health checks:**

```yaml
services:
  influxdb:
    healthcheck:
      test: ["CMD", "influx", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      
  grafana:
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1"]
      interval: 30s
```

**Monitor metrics about metrics:**

```flux
// Query: InfluxDB write performance
from(bucket: "_monitoring")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "influxdb_write")
  |> filter(fn: (r) => r["_field"] == "write_bytes")
  |> aggregateWindow(every: 1m, fn: sum)
```

---

## **Comparison with Alternatives**

| Aspect | Load Testing Lab | k6 Cloud | Grafana Cloud | JMeter + Custom Setup |
|--------|------------------|----------|---------------|----------------------|
| **Cost** | Free (OSS) | $49+/month | $50+/month | Free (OSS) |
| **Setup Time** | 5 minutes | Instant | 10 minutes | 2-4 hours |
| **Data Location** | Local | Cloud | Cloud | Local |
| **Customization** | Full control | Limited | Medium | Full control |
| **Scalability** | Limited (single node) | Excellent | Excellent | Medium |
| **Learning Curve** | Medium | Low | Low | High |
| **Best For** | Local dev/testing | CI/CD & large tests | Production monitoring | Complex enterprise scenarios |

---

## **Summary: When to Use This Architecture**

**✅ Great fit:**
- Local development and testing
- CI/CD integration (each PR gets load tested)
- Learning load testing concepts
- Cost-sensitive projects
- On-premise requirements

**❌ Not ideal:**
- Very large scale tests (>10K concurrent users)
- Distributed load generation required
- Need commercial support
- Regulatory requirements for managed services

---

## **Next Steps**

Now that you understand the architecture, you can:

1. **Customize components** - Swap k6 for Artillery, add Locust, use Prometheus
2. **Extend functionality** - Add custom metrics, integrate CI/CD, deploy to cloud
3. **Optimize performance** - Tune InfluxDB, optimize Grafana queries, scale horizontally
4. **Explore advanced topics** - Chaos engineering, distributed tracing, SLO monitoring

In the next article, we'll dive deep into the **quickstart workflow**, showing exactly how to configure and run your first comprehensive load test.

---

**Key Takeaways**

1. **Separation of concerns** enables swapping components independently
2. **Developer experience** matters - sensible defaults and auto-provisioning save hours
3. **Production patterns** used locally make eventual deployment easier
4. **Performance tuning** requires understanding each component's characteristics
5. **No silver bullet** - choose architecture based on your specific needs

**Continue Learning:** [Quickstart Deep Dive →](art2.md)
