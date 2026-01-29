# Usage Guide

Complete guide for running load tests with k6 and Artillery.

## Table of Contents

1. [Overview](#overview)
2. [Using the CLI](#using-the-cli)
3. [Running k6 Tests](#running-k6-tests)
4. [Running Artillery Tests](#running-artillery-tests)
5. [Test Scenarios](#test-scenarios)
6. [Interpreting Results](#interpreting-results)
7. [Advanced Usage](#advanced-usage)

---

## Overview

The Load Testing Lab supports two load testing engines:

- **k6**: JavaScript-based, great for HTTP APIs and custom logic
- **Artillery**: YAML-based, simple configuration for common patterns

Both engines send metrics to InfluxDB automatically, visible in Grafana dashboards.

---

## Using the CLI

The professional CLI provides streamlined commands for all operations.

### Setup CLI

```bash
# Option 1: Use via npm scripts (no setup)
npm run k6 -- -s my-test.js

# Option 2: Install globally for 'ltlab' command
npm link
ltlab k6 -s my-test.js
```

### Key Commands

```bash
# Start/Stop services
ltlab start                    # Start all services
ltlab stop                     # Stop all services
ltlab restart                  # Restart all or specific services

# Run tests
ltlab k6 -s scenario.js        # Run k6 test
ltlab artillery -s scenario.yml # Run Artillery test

# Generate scenarios
ltlab generate -e k6 -n my-test # Create test from blueprint

# Service management
ltlab configure                # Interactive configuration
ltlab scale -s k6 -r 5        # Scale service replicas
ltlab rebuild                  # Clean rebuild
ltlab purge                    # Full reset (dangerous!)

# View help
ltlab --help
ltlab <command> --help
```

See [CLI Documentation](../cli/README.md) for complete reference.

---

## Running k6 Tests

### Quick Start

```bash
# Using CLI (recommended)
ltlab k6 -s toy-fast.js

# Using npm script
npm run k6 -- -s toy-fast.js

# Direct Docker
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js
```

### Available k6 Scenarios

```bash
# Fast smoke test (30s)
ltlab k6 -s toy-fast.js

# Stress test (5 min)
ltlab k6 -s toy-stress.js

# Spike test (2 min)
ltlab k6 -s toy-spike.js

# Soak test (10 min)
ltlab k6 -s toy-soak.js

# Ramp-up test (5 min)
ltlab k6 -s toy-ramp.js

# Breakpoint test (incremental load)
ltlab k6 -s toy-breakpoint.js
```

### Override Environment Variables

```bash
# Change concurrency and duration
docker-compose run --rm \
  -e CONCURRENCY=100 \
  -e DURATION=5m \
  k6 run /k6/scenarios/toy-fast.js

# Or via CLI with custom env
CONCURRENCY=100 DURATION=5m ltlab k6 -s toy-fast.js
```

### Understanding k6 Output

```bash
# Example output
✅ K6 InfluxDB configured:
   Organization: myorg
   Bucket: loadtests
   Addr: http://influxdb:8086

output: InfluxDBv2 (http://influxdb:8086)

running (0m30.0s), 000/050 VUs, 1460 complete and 0 interrupted iterations
default ✓ [======================================] 050 VUs  30s

✓ status is 200

checks.........................: 100.00% ✓ 1460      ✗ 0
data_received..................: 584 kB  19 kB/s
data_sent......................: 175 kB  5.8 kB/s
http_req_blocked...............: avg=135.25µs min=2µs   med=8µs   max=9.82ms   p(95)=20µs
http_req_connecting............: avg=68.74µs  min=0s    med=0s    max=5.12ms   p(95)=0s
http_req_duration..............: avg=2.91ms   min=885µs med=2.5ms max=18.42ms  p(95)=5.2ms
  { expected_response:true }...: avg=2.91ms   min=885µs med=2.5ms max=18.42ms  p(95)=5.2ms
http_req_failed................: 0.00%   ✓ 0         ✗ 1460
http_req_receiving.............: avg=89.71µs  min=18µs  med=71µs  max=1.82ms   p(95)=183µs
http_req_sending...............: avg=42.94µs  min=7µs   med=35µs  max=892µs    p(95)=81µs
http_req_tls_handshaking.......: avg=0s       min=0s    med=0s    max=0s       p(95)=0s
http_req_waiting...............: avg=2.77ms   min=841µs med=2.38ms max=17.85ms p(95)=5ms
http_reqs......................: 1460    48.197/s
iteration_duration.............: avg=1.03s    min=1.01s med=1.02s max=1.2s     p(95)=1.05s
iterations.....................: 1460    48.197/s
vus............................: 50      min=50      max=50
vus_max........................: 50      min=50      max=50
```

**Key metrics:**
- `http_req_duration`: Response time (p95 = 95th percentile)
- `http_req_failed`: Error rate
- `http_reqs`: Requests per second
- `vus`: Current virtual users
- `checks`: Pass/fail validations

---

## Running Artillery Tests

### Quick Start

```bash
# Using CLI
ltlab artillery -s toy-fast.yml

# Using npm script
npm run artillery -- -s toy-fast.yml

# Direct Docker
docker-compose run --rm artillery run /artillery/scenarios/toy-fast.yml
```

### Available Artillery Scenarios

```bash
# Quick test
ltlab artillery -s toy-fast.yml

# Stress test
ltlab artillery -s toy-stress.yml

# Spike test
ltlab artillery -s toy-spike.yml

# Soak test
ltlab artillery -s toy-soak.yml
```

### Understanding Artillery Output

```bash
# Example output
Starting load test...

Summary report @ 14:32:45(+0200)
  Scenarios launched:  300
  Scenarios completed: 300
  Requests completed:  1800
  Mean response/sec: 59.8
  Response time (msec):
    min: 12
    max: 234
    median: 45
    p95: 89
    p99: 156
  Scenario duration (msec):
    min: 89
    max: 1234
    median: 234
    p95: 567
    p99: 890
  Codes:
    200: 1800
```

**Key metrics:**
- `Mean response/sec`: Requests per second (RPS)
- `Response time p95`: 95% of requests faster than this
- `Codes`: HTTP status code distribution
- `Scenarios completed`: Total successful test runs

---

## Test Scenarios

### Scenario Types

#### 1. Smoke Test (Quick Validation)
```bash
# k6: 10 VUs for 30s
ltlab k6 -s toy-fast.js

# Artillery: 5 VUs for 1 min
ltlab artillery -s toy-fast.yml
```

**Use case:** Verify system works before larger tests

#### 2. Load Test (Expected Traffic)
```bash
# k6: 50 VUs for 5 min
ltlab k6 -s toy-stress.js

# Artillery: 30 VUs for 5 min
ltlab artillery -s toy-stress.yml
```

**Use case:** Test normal production load

#### 3. Stress Test (Find Limits)
```bash
# k6: 100+ VUs ramping up
ltlab k6 -s toy-ramp.js

# Artillery: 50+ VUs ramping
ltlab artillery -s toy-stress.yml
```

**Use case:** Find breaking point

#### 4. Spike Test (Sudden Traffic)
```bash
# k6: Sudden jump to 200 VUs
ltlab k6 -s toy-spike.js

# Artillery: Burst phases
ltlab artillery -s toy-spike.yml
```

**Use case:** Test handling of traffic spikes

#### 5. Soak Test (Endurance)
```bash
# k6: 50 VUs for 10+ minutes
ltlab k6 -s toy-soak.js

# Artillery: Sustained load for 30+ min
ltlab artillery -s toy-soak.yml
```

**Use case:** Find memory leaks, resource exhaustion

---

## Interpreting Results

### In Terminal

**k6 output analysis:**
```
http_req_duration..: avg=2.91ms med=2.5ms max=18.42ms p(95)=5.2ms p(99)=8.1ms
```

- `avg`: Mean response time
- `med`: Median (50th percentile)
- `p(95)`: 95% of requests faster than this
- `p(99)`: 99% of requests faster than this
- `max`: Slowest request

**What's good?**
- ✅ p95 < 500ms (half second)
- ✅ p99 < 1000ms (1 second)
- ✅ http_req_failed < 1% (error rate)

**Artillery output analysis:**
```
Response time (msec):
  p95: 89
  p99: 156
Codes:
  200: 1800
  500: 2
```

- ✅ p95 < 100ms (fast)
- ✅ Most responses are 200 (success)
- ⚠️ Some 500 errors need investigation

### In Grafana

1. Open Grafana: http://localhost:3000
2. Navigate to dashboards
3. Select appropriate dashboard:
   - **k6 - Basic (War Room)**: Quick overview
   - **k6 - Pro**: Detailed analysis
   - **k6 - Elite**: Advanced metrics with heatmaps
   - **Artillery - Basic**: Overview
   - **Artillery - Pro**: Detailed
   - **Artillery - Elite**: Advanced

**Key panels to watch:**
- **HTTP Request Duration**: Response time trends
- **Requests Per Second**: Throughput
- **Error Rate**: Failures over time
- **Virtual Users**: Load progression
- **Top Slowest Endpoints**: Bottleneck identification

See [DASHBOARDS.md](DASHBOARDS.md) for complete dashboard guide.

---

## Advanced Usage

### Custom k6 Scripts

Create custom test scenarios:

```javascript
// k6/scenarios/my-custom-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(__ENV.TARGET_API_URL + '/api/endpoint');
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  sleep(1);
}
```

Run it:
```bash
ltlab k6 -s my-custom-test.js
```

### Custom Artillery Scenarios

```yaml
# artillery/scenarios/my-custom-test.yml
config:
  target: "{{ $processEnvironment.TARGET_API_URL }}"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
scenarios:
  - name: "Test my endpoint"
    flow:
      - get:
          url: "/api/endpoint"
          expect:
            - statusCode: 200
            - contentType: json
```

Run it:
```bash
ltlab artillery -s my-custom-test.yml
```

### Using Blueprints

Generate scenarios from templates:

```bash
# Interactive generation
ltlab generate

# Specify options
ltlab generate -e k6 -n my-api-test

# Available blueprints:
# - load (standard load test)
# - stress (find breaking point)
# - spike (sudden traffic burst)
# - soak (endurance test)
# - breakpoint (incremental load)
```

### Environment Overrides

```bash
# Override target URL
TARGET_API_URL=https://api.example.com ltlab k6 -s toy-fast.js

# Override multiple variables
CONCURRENCY=200 DURATION=10m TARGET_API_URL=https://staging.api.com \
  ltlab k6 -s toy-stress.js
```

### CI/CD Integration

```yaml
# .github/workflows/load-test.yml
name: Load Tests
on: [push]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start services
        run: docker-compose up -d
        
      - name: Wait for ready
        run: sleep 10
        
      - name: Run k6 test
        run: docker-compose run --rm k6 run /k6/scenarios/toy-fast.js
        
      - name: Check results
        run: node scripts/check-influx-token.js
        
      - name: Cleanup
        run: docker-compose down
```

---

## Next Steps

- **[DASHBOARDS.md](DASHBOARDS.md)** - Master Grafana visualization
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Fix common issues
- **[CLI Documentation](../cli/README.md)** - Learn all CLI commands
- **[Blog: Common Scenarios](../blog/advanced/art3.md)** - Realistic API testing examples
- **[Blog: Quickstart Guide](../blog/advanced/art2.md)** - Extended setup and usage patterns
- **[Blog Series Overview](../blog/README.md)** - Complete tutorial series

---

**Last Updated:** January 29, 2026
