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

Both engines send metrics to InfluxDB automatically, visible in Grafana dashboards: k6 through its InfluxDB output, Artillery through its built-in publish-metrics plugin and Telegraf. Each test runs in a container that starts for the test and is removed when it ends.

---

## Using the CLI

The professional CLI provides streamlined commands for all operations.

### Setup CLI

```bash
# Install the dependencies once (from the lab's folder)
npm install

# Option 1: Use via npm scripts (from the lab's folder)
npm run k6 -- -s my-test.js

# Option 2: Install globally for 'ltlab' command
npm link
ltlab k6 -s my-test.js
```

The `ltlab` command works from any directory and reads the lab's own `.env`.

### Key Commands

```bash
# Start/Stop services
ltlab start                    # Start all services, wait until they are ready
ltlab stop                     # Stop all services (metrics stay on their volume)
ltlab restart                  # Recreate all or specific services with the current .env

# Run tests
ltlab k6 -s scenario.js        # Run k6 test
ltlab artillery -s scenario.yml # Run Artillery test

# Generate scenarios
ltlab generate -e k6 -n my-test # Create test from blueprint

# Service management
ltlab configure                # Interactive configuration
ltlab info                     # Configuration and service health
ltlab rebuild                  # Clean rebuild
ltlab purge                    # Full reset (dangerous!)

# View help
ltlab --help
ltlab <command> --help
```

`ltlab k6`, `ltlab artillery`, `ltlab run` and `ltlab chaos` exit with the runner's exit code, so a failed threshold or check also fails the script or CI job that runs them.

See [CLI Documentation](../cli/README.md) for complete reference.

---

## Running k6 Tests

### Quick Start

```bash
# Using CLI (recommended)
ltlab k6 -s toy-fast.js

# Using npm script (from the lab's folder)
npm run k6 -- -s toy-fast.js

# Direct Docker (from the lab's folder)
docker compose run --rm k6 run /k6/scenarios/toy-fast.js
```

### Available k6 Scenarios

```bash
# Smoke test: GET /fast with CONCURRENCY VUs for DURATION (.env defaults: 50 VUs, 60s)
ltlab k6 -s toy-fast.js

# Mixed traffic: ramps to 60 VUs over /fast, /slow, /users, /cpu and /error (50s)
ltlab k6 -s toy-mixed.js

# Stress test: ramps to 300 VUs over /fast, /slow and /cpu (75s)
ltlab k6 -s toy-stress.js

# Async jobs: 20 VUs submit jobs to /jobs and poll their status (40s)
ltlab k6 -s toy-workers.js

# Chaos scenarios, written for the toy API's slow and failing routes (ltlab chaos always runs them against the toy API)
ltlab k6 -s chaos-basic.js        # 1m50s, up to 20 VUs
ltlab k6 -s chaos-spike.js        # 2m20s, from 10 to 50 VUs
ltlab k6 -s chaos-resilience.js   # 4m30s, 30 VUs that retry failed calls
```

### Override Environment Variables

```bash
# Change concurrency and duration for one run
ltlab k6 -s toy-fast.js -e CONCURRENCY=100 -e DURATION=5m

# Pass a variable from your shell (its value stays off the command line)
ltlab k6 -s ./load-tests/checkout.js -e API_TOKEN

# Direct Docker equivalent (from the lab's folder)
docker compose run --rm \
  -e CONCURRENCY=100 \
  -e DURATION=5m \
  k6 run /k6/scenarios/toy-fast.js
```

`-e KEY=value` passes the value as given, and `-e KEY` takes the value from your shell. Repeat `-e` for each variable.

### Understanding k6 Output

```bash
# Example output (abridged)
✅ K6 InfluxDB configured:
   Organization: myorg
   Bucket: loadtests
   Addr: http://influxdb:8086
...
        output: InfluxDBv2 (http://influxdb:8086)
...
```

The first lines come from the lab and confirm that k6 sends its metrics to InfluxDB. After the run, k6 prints its end-of-test summary in two parts:

- **THRESHOLDS**: each threshold of the scenario, marked ✓ or ✗, with the value measured. toy-fast.js has three: `p(95)<500` and `p(99)<1000` on `http_req_duration`, and `rate<0.01` on `http_req_failed`.
- **TOTAL RESULTS**: the metrics, grouped under HTTP, EXECUTION and NETWORK.

When a threshold fails, k6 exits with code 99, and so does `ltlab k6`, which prints "k6 test failed: at least one threshold was crossed (exit code 99)".

**Key metrics:**
- `http_req_duration`: Response time (p95 = 95th percentile)
- `http_req_failed`: Error rate
- `http_reqs`: Requests per second
- `vus`: Current virtual users
- `checks`: Pass/fail validations (in scenarios that use checks)

---

## Running Artillery Tests

### Quick Start

```bash
# Using CLI
ltlab artillery -s toy-fast.yml

# Using npm script (from the lab's folder)
npm run artillery -- -s toy-fast.yml

# Direct Docker (from the lab's folder)
docker compose run --rm artillery run /artillery/scenarios/toy-fast.yml
```

### Available Artillery Scenarios

```bash
# Smoke test: 50 new virtual users per second for 30s, each one does GET /fast
ltlab artillery -s toy-fast.yml

# Mixed traffic: /fast, /slow, /users, /cpu and /error weighted 40/20/15/15/10, up to 40 new users per second (50s)
ltlab artillery -s toy-mixed.yml

# Stress test: 50, then 120, then 250 new users per second over /fast, /slow and /cpu (55s)
ltlab artillery -s toy-stress.yml

# Async jobs: each user submits a job to /jobs, then polls its status (40s)
ltlab artillery -s toy-workers.yml

# Chaos scenarios (see ltlab chaos)
ltlab artillery -s chaos-basic.yml
ltlab artillery -s chaos-spike.yml
ltlab artillery -s chaos-resilience.yml
```

### Understanding Artillery Output

Artillery prints a report for every 10-second period ("Metrics for period to: ...") and, once every virtual user has finished, a "Summary report". Both list these metrics by name; the lab stores the same metrics in InfluxDB, under measurements whose names start with `artillery`:

- `http.requests`, `http.responses`: requests sent and responses received
- `http.request_rate`: requests per second
- `http.codes.200`, `http.codes.500`, ...: responses by status code
- `http.response_time`: min, max, mean, median, p95 and p99, in milliseconds
- `vusers.created`, `vusers.completed`, `vusers.failed`: virtual users started, finished and failed (each one runs one scenario)
- `vusers.session_length`: how long a virtual user took to run its scenario

A scenario with `ensure` checks (toy-fast.yml has `p95: 500`, `p99: 1000` and `maxErrorRate: 1`) then prints "Checks:" and one `ok:` or `fail:` line per check, such as `ok: p95 < 500`. When a check fails, Artillery exits with code 1, and so does `ltlab artillery`.

**Key metrics:**
- `http.request_rate`: Requests per second (RPS)
- `http.response_time` p95: 95% of requests faster than this
- `http.codes.<status>`: HTTP status code distribution
- `vusers.completed`: Virtual users that finished their scenario

---

## Test Scenarios

### Scenario Types

#### 1. Smoke Test (Quick Validation)
```bash
# k6: CONCURRENCY VUs for DURATION (.env defaults: 50 VUs, 60s)
ltlab k6 -s toy-fast.js

# Artillery: 50 new virtual users per second for 30s
ltlab artillery -s toy-fast.yml
```

**Use case:** Verify system works before larger tests. Both pass when p95 stays under 500 ms, p99 under 1000 ms, and errors within 1% (k6 counts failed requests; Artillery counts virtual users that did not complete).

#### 2. Load Test (Expected Traffic)
```bash
# k6: ramps to 60 VUs over a mix of endpoints (50s)
ltlab k6 -s toy-mixed.js

# Artillery: the same mix, up to 40 new virtual users per second (50s)
ltlab artillery -s toy-mixed.yml
```

**Use case:** Test normal production load. For a longer run, generate a scenario from the steady-load blueprint.

#### 3. Stress Test (Find Limits)
```bash
# k6: ramps to 300 VUs
ltlab k6 -s toy-stress.js

# Artillery: up to 250 new virtual users per second
ltlab artillery -s toy-stress.yml
```

**Use case:** Find breaking point

#### 4. Spike Test (Sudden Traffic)
```bash
# k6: rises from 10 to 50 VUs in 30s while hitting the slow and failing routes
ltlab k6 -s chaos-spike.js

# Artillery: jumps from 5 to 30 new virtual users per second, same routes
ltlab artillery -s chaos-spike.yml

# Your own spike test: start from the spike-load blueprint
ltlab generate -e k6 -n my-spike
```

**Use case:** Test handling of traffic spikes

#### 5. Soak Test (Endurance)
```bash
# Start from the steady-load blueprint, then set a long duration and your endpoints
ltlab generate -e k6 -n my-soak
ltlab k6 -s my-soak.js
```

**Use case:** Find memory leaks, resource exhaustion. Against the toy API, memory stays flat: it drops each finished job 10 minutes after the job finishes.

---

## Interpreting Results

### In Terminal

**k6 output analysis:**
```
http_req_duration..: avg=2.91ms med=2.5ms max=18.42ms p(95)=5.2ms
```

- `avg`: Mean response time
- `med`: Median (50th percentile)
- `p(95)`: 95% of requests faster than this
- `p(99)`: 99% of requests faster than this (shown in the THRESHOLDS section when a threshold uses it, as in toy-fast.js)
- `max`: Slowest request

**What's good?**
- ✅ p95 < 500ms (half second)
- ✅ p99 < 1000ms (1 second)
- ✅ http_req_failed < 1% (error rate)

These are the thresholds of toy-fast.js and the `ensure` checks of toy-fast.yml.

**Artillery output analysis:**
```
http.codes.200: ........ 1800
http.codes.500: ........ 2
http.response_time:
  p95: ................. 89
  p99: ................. 156
```

- ✅ p95 < 100ms (fast)
- ✅ Most responses are 200 (success)
- ⚠️ Some 500 errors need investigation

### In Grafana

1. Open Grafana: http://localhost:3000
2. Navigate to dashboards
3. Select appropriate dashboard:
   - **k6 Load Testing - War Room**: Quick overview
   - **K6 Load Testing - Pro Dashboard**: Detailed analysis
   - **K6 Elite Performance War Room**: Advanced metrics with heatmaps
   - **Artillery + Telegraf - War Room**: Overview
   - **Artillery Load Testing - Pro Dashboard**: Detailed
   - **Artillery Elite Load & Stress War Room**: Advanced

Every dashboard shows the last 30 minutes and refreshes every 5 seconds.

**Key panels to watch:**
- **HTTP Request Duration**: Response time trends
- **Requests Per Second**: Throughput
- **Error Rate**: Failures over time
- **Virtual Users**: Load progression
- **Top 10 Slowest Endpoints**: Bottleneck identification (k6)

**On the Artillery dashboards:**
- Panels trail the run by up to about 20 seconds: Artillery reports every 10 seconds, and Telegraf flushes to InfluxDB every 10 seconds.
- The percentile stats are titled "p50, worst report" to "p99, worst report". Each one shows the highest value among Artillery's 10-second reports, an upper bound on the run's percentile: Artillery sends its percentiles already computed per period, so the exact percentile of the whole run is in Artillery's own summary report.

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

A file in `k6/scenarios/` runs by its name; a file anywhere else runs by its path (`ltlab k6 -s ./load-tests/my-custom-test.js`). The thresholds decide the exit code: 99 when one fails.

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
  plugins:
    # Sends Artillery's metrics to Telegraf, which writes them to InfluxDB
    publish-metrics:
      - type: statsd
        host: "{{ $processEnvironment.STATSD_HOST }}"
        port: "{{ $processEnvironment.STATSD_PORT }}"
        prefix: "artillery."
    # Applies the expect blocks below (only failures are printed)
    expect:
      outputFormat: prettyError
    # Applies the ensure checks below: a missed one makes the run exit with code 1
    ensure: {}
  ensure:
    p95: 500
    maxErrorRate: 1
scenarios:
  # No spaces in scenario names: StatsD cuts a name at its first space
  - name: "test-my-endpoint"
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

Without the publish-metrics plugin, Artillery runs but sends nothing to the lab. Keep the prefix `artillery.`, which Telegraf's templates and the dashboards rely on. The `expect` and `ensure` plugins come with Artillery, and apply only when they are listed under `config.plugins`.

### Using Blueprints

Generate scenarios from templates:

```bash
# Interactive generation
ltlab generate

# Specify options (the blueprint is picked from a list)
ltlab generate -e k6 -n my-api-test

# Available blueprints:
# - steady-load (constant load over time)
# - ramp-up-down (gradual increase and decrease)
# - spike-load (sudden traffic spikes)
# - endpoint-thinktime (realistic user behavior with delays)
# - variable-traffic (arrival rate that rises and falls over ten minutes)
```

The new file goes to the lab's `k6/scenarios/` or `artillery/scenarios/`, wherever you run the command from. Its endpoints are placeholders: edit them before running it.

### Environment Overrides

```bash
# Override target URL for one run
ltlab k6 -s ./load-tests/smoke.js -e TARGET_API_URL=https://api.example.com

# Override multiple variables
ltlab k6 -s toy-fast.js -e CONCURRENCY=200 -e DURATION=10m

# Take a secret from your shell, without writing it on the command line
ltlab k6 -s ./load-tests/checkout.js -e API_TOKEN
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
      - uses: actions/checkout@v4

      # ltlab configure is interactive: in CI, write the lab's .env directly
      - name: Configure the lab
        run: |
          echo "INFLUXDB_TOKEN=$(openssl rand -hex 32)" > .env
          echo "TARGET_API_URL=http://toy-api:5000" >> .env

      - name: Start services
        run: |
          docker compose build k6
          docker compose up -d --wait

      # Exits with k6's exit code: 99 fails the job when a threshold is crossed
      - name: Run k6 test
        run: docker compose run --rm k6 run /k6/scenarios/toy-fast.js

      - name: Cleanup
        if: always()
        run: docker compose down -v
```

---

## Next Steps

- **[DASHBOARDS.md](DASHBOARDS.md)** - Master Grafana visualization
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Fix common issues
- **[CLI Documentation](../cli/README.md)** - Learn all CLI commands
- **[Blog: Common Scenarios](https://destbreso.com/blog/modeling-real-traffic-for-load-tests)** - Realistic API testing examples
- **[Blog: Quickstart Guide](https://destbreso.com/blog/load-testing-lab-getting-started)** - Extended setup and usage patterns
- **[Blog Series Overview](https://destbreso.com/blog/series/load-testing-lab-guide)** - Complete tutorial series
