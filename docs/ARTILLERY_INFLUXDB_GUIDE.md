# Guide: Integrating Artillery with InfluxDB v2

**This integration is already implemented in the project.**

Artillery sends metrics to InfluxDB v2 automatically using the following architecture:

**Artillery** → (StatsD) → **Telegraf** → **InfluxDB v2** → **Grafana**

### Current Status

✅ **Telegraf configured** in `docker-compose.yml` and `telegraf/telegraf.conf`  
✅ **Artillery Dockerfile** includes `artillery-plugin-statsd`  
✅ **Scenarios updated** with automatic StatsD configuration  
✅ **Grafana Dashboard** provisioned (`artillery-telegraf.json`)  
✅ **Metrics working** without manual configuration

### Quick Usage

```bash
# 1. Ensure Telegraf is running
docker-compose up -d telegraf

# 2. Run Artillery test
docker-compose run --rm artillery run /artillery/scenarios/toy-fast.yml

# 3. View metrics in Grafana
# Dashboard: "Artillery + Telegraf - Real-time Metrics"
```

---

## Implemented Architecture

### Data Flow

```
Artillery Test
    ↓ (StatsD Protocol - UDP 8125)
Telegraf (inputs.statsd)
    ↓ (InfluxDB v2 Line Protocol)
InfluxDB v2 (bucket: loadtests)
    ↓ (Flux Queries)
Grafana (Dashboard)
```

### Components

1. **Artillery + artillery-plugin-statsd**: Generates metrics and sends via StatsD
2. **Telegraf**: Receives StatsD, aggregates, and sends to InfluxDB v2
3. **InfluxDB v2**: Stores time series
4. **Grafana**: Visualizes with Flux queries

---

## Original Problem

Artillery has no native support for InfluxDB v2. To send Artillery metrics to InfluxDB, you need to implement one of the following solutions.

---

## Solution 1: Use Telegraf (Recommended) ⭐

Telegraf acts as an intermediary that receives Artillery metrics via StatsD and sends them to InfluxDB v2.

### Step 1: Add Telegraf to docker-compose.yml

```yaml
services:
  # ... existing services ...
  
  telegraf:
    image: telegraf:1.28-alpine
    container_name: telegraf
    volumes:
      - ./telegraf/telegraf.conf:/etc/telegraf/telegraf.conf:ro
    ports:
      - "8125:8125/udp"  # StatsD
    depends_on:
      - influxdb
    networks:
      - ltl-net
    environment:
      - INFLUXDB_URL=http://influxdb:8086
      - INFLUXDB_TOKEN=${INFLUXDB_TOKEN}
      - INFLUXDB_ORG=${INFLUXDB_ORG}
      - INFLUXDB_BUCKET=${INFLUXDB_BUCKET}
```

### Step 2: Create telegraf/telegraf.conf

```toml
# telegraf/telegraf.conf

[agent]
  interval = "10s"
  round_interval = true
  metric_batch_size = 1000
  metric_buffer_limit = 10000
  collection_jitter = "0s"
  flush_interval = "10s"
  flush_jitter = "0s"
  precision = ""

# Input: StatsD (receives Artillery metrics)
[[inputs.statsd]]
  protocol = "udp"
  service_address = ":8125"
  delete_gauges = true
  delete_counters = true
  delete_sets = true
  delete_timings = true
  percentiles = [50, 90, 95, 99]
  metric_separator = "."
  parse_data_dog_tags = false
  datadog_extensions = false
  allowed_pending_messages = 10000
  percentile_limit = 1000

# Output: InfluxDB v2
[[outputs.influxdb_v2]]
  urls = ["${INFLUXDB_URL}"]
  token = "${INFLUXDB_TOKEN}"
  organization = "${INFLUXDB_ORG}"
  bucket = "${INFLUXDB_BUCKET}"
  timeout = "5s"
  user_agent = "telegraf"
  
  # Additional tags to identify Artillery data
  [outputs.influxdb_v2.tagpass]
    source = ["artillery"]
```

### Step 3: Configure Artillery to use StatsD

Update your Artillery scenarios (e.g., `artillery/scenarios/toy-fast.yml`):

```yaml
config:
  target: "{{ $processEnvironment.TARGET_API_URL }}"
  phases:
    - duration: 30
      arrivalRate: 50
  
  # Add StatsD plugin
  plugins:
    statsd:
      host: telegraf  # service name in Docker
      port: 8125
      prefix: "artillery"
      
  # Custom metrics to send
  ensure:
    maxErrorRate: 1  # maximum 1% errors
    
scenarios:
  - flow:
      - get:
          url: "/fast"
```

### Step 4: Install StatsD plugin in Artillery

Actualiza `artillery/Dockerfile`:

```dockerfile
FROM node:20-alpine

RUN npm install -g artillery artillery-plugin-statsd

WORKDIR /artillery

ENTRYPOINT ["artillery"]
```

### Step 5: Rebuild and test

```bash
# Rebuild Artillery with plugin
docker-compose build artillery

# Start all services including Telegraf
docker-compose up -d

# Run an Artillery test
docker-compose run --rm artillery run /artillery/scenarios/toy-fast.yml
```

---

## Solution 2: Custom Artillery Plugin

If you prefer not to use Telegraf, you can create a custom Artillery plugin that sends directly to InfluxDB v2.

### Step 1: Create the plugin

Create `artillery/plugins/influxdb-v2-plugin.js`:

```javascript
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

module.exports = {
  Plugin: InfluxDBv2Plugin
};

function InfluxDBv2Plugin(script, events) {
  const influxUrl = process.env.INFLUXDB_URL || 'http://influxdb:8086';
  const token = process.env.INFLUXDB_TOKEN;
  const org = process.env.INFLUXDB_ORG || 'myorg';
  const bucket = process.env.INFLUXDB_BUCKET || 'loadtests';

  const client = new InfluxDB({ url: influxUrl, token });
  const writeApi = client.getWriteApi(org, bucket);
  writeApi.useDefaultTags({ source: 'artillery' });

  // Send metrics when requests complete
  events.on('stats', (stats) => {
    const timestamp = Date.now();
    
    // Latency
    if (stats.latency) {
      const point = new Point('http_req_duration')
        .floatField('min', stats.latency.min)
        .floatField('max', stats.latency.max)
        .floatField('median', stats.latency.median)
        .floatField('p95', stats.latency.p95)
        .floatField('p99', stats.latency.p99)
        .timestamp(timestamp);
      writeApi.writePoint(point);
    }

    // Requests
    if (stats.codes) {
      Object.keys(stats.codes).forEach(code => {
        const point = new Point('http_requests')
          .tag('status_code', code)
          .intField('count', stats.codes[code])
          .timestamp(timestamp);
        writeApi.writePoint(point);
      });
    }

    // Errors
    if (stats.errors) {
      const point = new Point('errors')
        .intField('count', Object.keys(stats.errors).length)
        .timestamp(timestamp);
      writeApi.writePoint(point);
    }

    // Flush data
    writeApi.flush();
  });

  // Close connection when done
  events.on('done', async () => {
    try {
      await writeApi.close();
    } catch (err) {
      console.error('Error closing InfluxDB connection:', err);
    }
  });
}
```

### Step 2: Install dependencies

Update `artillery/Dockerfile`:

```dockerfile
FROM node:20-alpine

RUN npm install -g artillery
RUN npm install -g @influxdata/influxdb-client

WORKDIR /artillery

ENTRYPOINT ["artillery"]
```

### Step 3: Use plugin in scenarios

```yaml
config:
  target: "{{ $processEnvironment.TARGET_API_URL }}"
  phases:
    - duration: 30
      arrivalRate: 50
  
  # Reference custom plugin
  plugins:
    influxdb-v2-plugin:
      path: "/artillery/plugins/influxdb-v2-plugin.js"

scenarios:
  - flow:
      - get:
          url: "/fast"
```

---

## Solution 3: Post-Processing Script (Simpler but less real-time)

You can have Artillery save JSON reports and then process them to send to InfluxDB.

### Step 1: Run Artillery with JSON output

```bash
docker-compose run --rm artillery run \
  --output /artillery/results/report.json \
  /artillery/scenarios/toy-fast.yml
```

### Step 2: Create script to parse and send

Create `scripts/artillery-to-influx.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const reportPath = process.argv[2];
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const influxUrl = process.env.INFLUXDB_URL || 'http://localhost:8086';
const token = process.env.INFLUXDB_TOKEN;
const org = process.env.INFLUXDB_ORG || 'myorg';
const bucket = process.env.INFLUXDB_BUCKET || 'loadtests';

const client = new InfluxDB({ url: influxUrl, token });
const writeApi = client.getWriteApi(org, bucket);

// Process aggregate data
const summary = report.aggregate;
const timestamp = Date.now();

// Latencies
const latPoint = new Point('http_req_duration')
  .tag('tool', 'artillery')
  .floatField('min', summary.latency.min)
  .floatField('max', summary.latency.max)
  .floatField('median', summary.latency.median)
  .floatField('p95', summary.latency.p95)
  .floatField('p99', summary.latency.p99)
  .timestamp(timestamp);
writeApi.writePoint(latPoint);

// Request rate
const reqPoint = new Point('http_requests')
  .tag('tool', 'artillery')
  .intField('count', summary.scenariosCompleted)
  .intField('rate', summary.requestsCompleted / (summary.lastMetricAt - summary.firstMetricAt) * 1000)
  .timestamp(timestamp);
writeApi.writePoint(reqPoint);

writeApi.close().then(() => {
  console.log('✅ Metrics sent to InfluxDB');
});
```

### Step 3: Execute

```bash
# Run test
docker-compose run --rm artillery run \
  --output /artillery/results/report.json \
  /artillery/scenarios/toy-fast.yml

# Enviar a InfluxDB
node scripts/artillery-to-influx.js artillery/results/report.json
```

---

## Solution Comparison

| Solution              | Complexity | Real-time | Detailed Metrics | Recommended |
|-----------------------|------------|-----------|------------------|-------------|
| **Telegraf + StatsD** | Medium     | ✅ Yes     | ✅ Yes            | ⭐⭐⭐⭐⭐       |
| **Custom Plugin**     | High       | ✅ Yes     | ✅ Yes            | ⭐⭐⭐⭐        |
| **Post-Processing**   | Low        | ❌ No      | ⚠️ Partial       | ⭐⭐⭐         |

---

## Final Recommendation

**Use Solution 1 (Telegraf)** because:
- ✅ Most robust and scalable
- ✅ Doesn't modify Artillery (uses standard plugins)
- ✅ Telegraf widely used in production
- ✅ Real-time metrics
- ✅ Easy to maintain and extend

---

## Next Steps

1. Implement chosen solution
2. Create Grafana dashboards specific to Artillery
3. Document in README.md
4. Add usage examples

**Related Resources:**
- [Blog: Quickstart Guide](../blog/advanced/art2.md) - Extended setup with k6 and Artillery
- [Blog: Common Scenarios](../blog/advanced/art3.md) - Practical Artillery examples
- [USAGE.md](USAGE.md) - Complete usage guide with Artillery commands

---

## References

- [Artillery StatsD Plugin](https://www.artillery.io/docs/guides/plugins/plugin-statsd-influxdb-graphite)
- [Telegraf InfluxDB Output](https://docs.influxdata.com/telegraf/v1.28/plugins/outputs/influxdb_v2/)
- [InfluxDB Client Libraries](https://docs.influxdata.com/influxdb/v2.0/api-guide/client-libraries/)
