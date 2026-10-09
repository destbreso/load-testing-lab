# Chaos Engineering Scenarios

Chaos scenarios exercise the **toy API's failure routes**: slow responses, random errors, CPU and I/O load. `ltlab chaos` always runs them against the toy API: it passes `TARGET_API_URL=http://toy-api:5000` to the run, whatever `.env` says. They are useful for:

- 📚 **Teaching and tutorials** - Show what load testing metrics look like when things go wrong
- 🎯 **Dashboard testing** - Check that your Grafana dashboards display errors and latency correctly
- 🎓 **Demos** - Show load testing concepts without an external API
- 🧪 **Learning chaos engineering** - Watch how a system behaves under failures

Both **k6** and **Artillery** have chaos scenarios that test the same endpoints with different approaches. The Artillery files are self-contained YAML, with no processor file.

---

## Available Scenarios

### 🟡 chaos-basic (k6 & Artillery)
**Mixed chaos with random errors, latency, and resource issues**

Tests multiple chaotic endpoints with varied behaviors:
- `/fast` - Normal response
- `/slow` - Variable latency (500-2500ms)
- `/error` - Random failures (30% rate)
- `/cpu` - CPU-intensive operations

**k6 Implementation:**
- Stages: 30s ramp-up to 20 VUs → 1min at 20 VUs → 20s ramp-down
- Each iteration picks one endpoint at random, weighted 3/2/2/1 (fast/slow/error/cpu)
- Each request is tagged `endpoint` with the route's label (`Fast endpoint`, `Slow endpoint`, `Error prone`, `CPU intensive`), so k6's own `scenario` tag stays intact
- Custom metrics: Rates `errors` (status other than 200, or 3s or more) and `timeouts`
- Thresholds: p(95) < 3s, `errors` rate < 50%

**Artillery Implementation:**
- Phases: 30s at 10 new virtual users per second → 60s at 20/s → 20s at 5/s
- Two weighted scenarios: `mixed-chaos-scenario` (weight 10: three rounds of `/fast`, `/slow`, `/error`, `/cpu` with think times) and `error-resilience` (weight 5: five calls to `/error`)
- `expect` blocks check `/slow` and `/cpu`; the expect plugin is enabled and prints only failures
- Metrics to Telegraf through publish-metrics

**Useful for:** Learning to interpret mixed failure patterns in dashboards.

**Run with:**
```bash
# k6
ltlab chaos -e k6     # then choose Basic
ltlab k6 -s chaos-basic.js

# Artillery
ltlab chaos -e artillery
ltlab artillery -s chaos-basic.yml
```

`ltlab k6 -s` and `ltlab artillery -s` use `TARGET_API_URL` from `.env`; if it points at another API, add `-e TARGET_API_URL=http://toy-api:5000`.

---

### 🔴 chaos-spike (k6 & Artillery)
**Traffic spike with simultaneous failures**

Simulates everything going wrong at once with sudden traffic increases.

Tests all problematic endpoints in sequence:
- `/slow` - Latency issues
- `/error` - Random failures
- `/cpu` - CPU overload
- `/io` - I/O bottleneck

**k6 Implementation:**
- Stages: 20s to 10 VUs → 30s to 50 VUs → 40s at 50 → 30s down to 10 → 20s down to 0
- Each iteration calls `/slow`, `/error`, `/cpu` and `/io` in sequence, pausing 0.2s after each; requests are tagged `endpoint` and `chaos_type`
- Custom metrics: Rates `errors` and `timeouts`, and the Trend `pass_duration`: the time for one pass through the four routes, pauses included
- Think time: 2-5s after a pass with more than two errors, 0.5-2s otherwise
- Thresholds: p(99) < 5s, `errors` rate < 60%, `timeouts` rate < 20%

**Artillery Implementation:**
- Phases: 20s at 5 new virtual users per second → 30s at 30/s → 40s at 30/s → 30s at 5/s
- Two scenarios: `everything-goes-wrong` (weight 10: `/slow`, `/error`, `/cpu`, `/io`, with `expect` checks) and `rapid-fire-chaos` (weight 5: ten requests to random paths, which the toy API answers with 404)
- `ensure` checks: `maxErrorRate: 60`, `p99: 5000`

**Useful for:** Understanding system behavior under traffic spikes and simultaneous stress.

**Run with:**
```bash
# k6
ltlab chaos -e k6
ltlab k6 -s chaos-spike.js

# Artillery
ltlab chaos -e artillery
ltlab artillery -s chaos-spike.yml
```

---

### 🟢 chaos-resilience (k6 & Artillery)
**Test retry logic and error recovery**

Focuses on resilience patterns and error recovery mechanisms.

**k6 Implementation:**
- Calls `/error` with up to 3 attempts, waiting 0.5s after the first failed attempt and 1s after the second (exponential backoff)
- Requests are tagged `attempt` (1, 2 or 3)
- In 30% of iterations, also calls one of `/fast`, `/slow` or `/cpu`
- Stages: 1min ramp-up to 30 VUs → 3min at 30 → 30s ramp-down
- Custom metrics: Rate `errors` (calls that still failed after their attempts), Trend `attempts` (attempts each call needed), Counter `retries` (recorded, without a threshold)
- Thresholds: p(90) < 4s, `errors` rate < 40%, `attempts` avg < 1.5

`/error` fails 30% of the time, so a call needs 1.39 attempts on average (1 + 0.3 + 0.09). The `attempts` threshold leaves room for normal variation and fails when `/error` fails clearly more often than that.

**Artillery Implementation:**
- Two scenarios: `retry-logic-testing` (weight 10: three calls to `/error` with waits in between; the third expects 200 or 500) and `mixed-reliability` (weight 5: two rounds of `/fast`, `/error`, `/slow`, then `/cpu` and `/io`)
- Phases: 60s at 15 new virtual users per second → 180s at 20/s → 30s at 5/s
- `ensure` checks: `maxErrorRate: 40`, `p95: 4000`

**Useful for:** Learning how to handle errors gracefully and measure recovery.

**Run with:**
```bash
# k6
ltlab chaos -e k6
ltlab k6 -s chaos-resilience.js

# Artillery
ltlab chaos -e artillery
ltlab artillery -s chaos-resilience.yml
```

---

## Pass, Fail and Exit Codes

`ltlab chaos`, `ltlab k6` and `ltlab artillery` exit with the runner's exit code:

- **k6** exits with 99 when a threshold fails
- **Artillery** prints its `ensure` conditions under `Checks:`, each marked `ok` or `fail`, and exits with 1 when one fails. A failed `expect` check is printed during the run and makes Artillery exit with 21, unless an `ensure` check failed too

Artillery's `maxErrorRate` is the share of virtual users that did not complete their scenario, not the share of 5xx responses. A failed expectation does not stop its virtual user, which goes on with its scenario. `chaos-basic.yml` has `expect` checks but no `ensure` checks.

---

## What You'll Learn

By running these scenarios and watching the Grafana dashboards, you'll understand:

1. **Error Rate Patterns**
   - How error spikes appear in graphs
   - Difference between sustained and intermittent errors
   - Impact of retry logic on error rates

2. **Response Time Metrics**
   - What p50, p95, p99 mean in practice
   - How latency affects different percentiles
   - Response time distribution under chaos

3. **Recovery Patterns**
   - How long systems take to stabilize
   - Visual indicators of recovery in metrics
   - Difference between graceful and catastrophic degradation

4. **Resource Impact**
   - CPU-intensive operations and throughput
   - I/O bottlenecks
   - Correlation between load and response times

5. **Chaos Engineering Principles**
   - Controlled failures in a safe environment
   - Baseline versus chaos: compare normal and stressed behavior
   - Retry strategies such as exponential backoff, and their cost

---

## Using with Grafana

All chaos scenarios produce metrics visible in the Grafana dashboards (http://localhost:3000).

### k6 Metrics Flow
```
k6 → InfluxDB v2 → Grafana
```

**Available Dashboards:**
- **k6 Load Testing - War Room** (`k6-dashboard`) - Request duration, VUs, slowest endpoints, percentiles
- **K6 Load Testing - Pro Dashboard** (`k6-pro`) - Requests per second, error rate, request phases
- **K6 Elite Performance War Room** (`k6-elite`) - Heatmap, success rate, VU utilization

The scenarios' custom metrics (`errors`, `timeouts`, `pass_duration`, `attempts`, `retries`) are stored as measurements with their samples in the field `value`, and the tags `endpoint`, `chaos_type` and `attempt` travel with each request. The built-in dashboards do not chart them; query them in Explore or in a panel of your own. For example, the average number of attempts per call in `chaos-resilience.js`:

```flux
from(bucket: v.defaultBucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "attempts" and r["_field"] == "value")
  |> group()
  |> mean()
```

And the p95 of each endpoint in `chaos-basic.js`:

```flux
from(bucket: v.defaultBucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration" and r["_field"] == "value")
  |> group(columns: ["endpoint"])
  |> quantile(q: 0.95, method: "exact_mean")
```

### Artillery Metrics Flow
```
Artillery → publish-metrics (StatsD) → Telegraf → InfluxDB v2 → Grafana
```

**Available Dashboards:**
- **Artillery + Telegraf - War Room** (`artillery-telegraf`) - Requests per second, latency, totals
- **Artillery Load Testing - Pro Dashboard** (`artillery-pro`) - Status codes, scenarios completed, virtual users per scenario name
- **Artillery Elite Load & Stress War Room** (`artillery-elite`) - Success rates, status code distribution, scenario counts

Scenario names reach InfluxDB as fields of `artillery_vusers_created_by_name`; StatsD cuts a name at its first space, which is why the lab's scenario names are in kebab-case. Artillery panels trail a run by up to about 20 seconds.

### Recommended Viewing
1. Open the dashboard for your engine in Grafana
2. Start the chaos scenario (`ltlab chaos` prints the Grafana URL when it finishes)
3. Watch metrics change as the run progresses (dashboards refresh every 5 seconds)
4. Identify patterns during ramp-up, sustained load, and recovery
5. Compare behavior across different chaos types

### Key Panels to Watch
- **Requests Per Second** - Traffic patterns (spikes, sustained load)
- **Response Time Percentiles** - p95/p99 during chaos
- **Error Rate (%)** (k6) and **HTTP Response Codes** (Artillery) - Failures during stress
- **Virtual Users** (k6) and **Scenario Counts** (Artillery) - Load against response times
- **Success Rate** and **Scenario Success Rate** - How much of the run succeeded

---

## k6 vs Artillery: Choosing the Right Tool

Both engines can run chaos scenarios, but they have different strengths:

### k6 Strengths
- **JavaScript-based** - Familiar syntax for developers
- **Rich scripting** - Complex logic, conditionals, custom functions
- **Custom metrics** - Define your own counters, rates and trends
- **Thresholds** - Built-in pass/fail criteria
- **Checks** - In-script assertions
- **HTTP/2, WebSocket, gRPC** - Protocol support

**Best for:**
- Developers comfortable with JavaScript
- Complex test scenarios with logic
- Custom metric tracking
- API testing with validations
- CI/CD integration with thresholds

### Artillery Strengths
- **YAML-based** - No programming needed
- **Scenario weighting** - Distribute load across scenarios
- **Phases** - Define traffic patterns easily
- **Think time** - Simulate realistic user behavior
- **Loop constructs** - Repeat actions without code
- **Plugins** - publish-metrics, expect, ensure and more
- **Expectations** - Simple pass/fail conditions

**Best for:**
- Non-developers (QA, DevOps)
- Quick scenario creation
- Realistic user behavior simulation
- Weight-based load distribution
- Teaching load testing basics

### Chaos Scenarios Comparison

| Feature                | k6                         | Artillery                                   |
|------------------------|----------------------------|---------------------------------------------|
| **Syntax**             | JavaScript                 | YAML                                        |
| **Load control**       | VUs (virtual users)        | Arrival rate (new virtual users per second) |
| **Retry logic**        | Custom code                | Sequential calls + waits                    |
| **Endpoint selection** | Weighted random            | Scenario weights                            |
| **Custom metrics**     | `Trend`, `Counter`, `Rate` | From JavaScript processor functions         |
| **Thresholds**         | Built-in                   | `ensure` plugin                             |
| **Think time**         | `sleep()` function         | `think: X` property                         |
| **Complexity**         | More flexible              | More structured                             |

### When to Use Each

**Use k6 when:**
- ✅ You need complex logic or conditionals
- ✅ Testing requires custom metrics/thresholds
- ✅ Developers are writing tests
- ✅ You want in-script validations (checks)
- ✅ CI/CD requires pass/fail criteria

**Use Artillery when:**
- ✅ Non-developers are creating tests
- ✅ Simple traffic patterns are sufficient
- ✅ You need realistic think times
- ✅ Weight-based distribution is easier
- ✅ Teaching load testing to beginners

---

## Target API Endpoints (toy-api)

All chaos scenarios target these toy API endpoints:

| Endpoint | Behavior                                                    | Use Case            |
|----------|-------------------------------------------------------------|---------------------|
| `/fast`  | Responds immediately with JSON                              | Baseline (no chaos) |
| `/slow`  | Waits 500-2500ms before responding                          | Latency testing     |
| `/error` | Answers 500 in 30% of requests                              | Error handling      |
| `/cpu`   | Runs a synchronous loop of 10 million square roots          | Resource stress     |
| `/io`    | Waits 300-1500ms (simulated I/O)                            | I/O bottleneck      |

`/cpu` blocks the toy API's event loop while it runs, so under load it also slows down every other route.

**Why toy-api?**
- 🔒 **Safe** - No external dependencies
- 🎯 **Predictable** - Known failure rates
- 📚 **Educational** - Clear cause-effect relationships
- 🚀 **Fast** - Starts with the lab, no configuration

---

## Tips for Teaching & Demos

### Before Running Scenarios
1. Start the lab (the toy API included): `ltlab start`
2. Open Grafana: `http://localhost:3000`
3. Explain chaos engineering concepts
4. Show endpoint behaviors (optional: `curl http://localhost:5000/fast`, with the port from `TOY_API_PORT`)
5. Start with chaos-basic, the easiest to follow; show a normal run (`toy-fast`) first if you want a baseline

### During Scenarios
1. Run the chaos scenario: `ltlab chaos`
2. Watch the Grafana dashboards
3. Point out key metrics as they change, one metric at a time
4. Explain why certain patterns appear
5. Show correlation between load and response times

### After Scenarios
1. Review the final dashboard state
2. Compare normal and chaos behavior
3. Discuss what worked and what failed
4. Explain recovery patterns
5. Show how to interpret percentiles; use chaos-resilience to discuss error handling

### Common Teaching Points
- **Why p95/p99 matter** - The median hides the slow requests that a share of users still get
- **Error budgets** - A 1% error rate is the equivalent of about 7 hours of downtime in a 30-day month
- **Retry storms** - Aggressive retries can worsen failures
- **Graceful degradation** - Systems should handle load gracefully
- **Observability** - Can't fix what you can't measure

### Demo Gotchas
- ⚠️ **InfluxDB retention** - The bucket keeps everything unless you set a retention in the InfluxDB UI (`ltlab metrics` shows it); `ltlab reset` deletes stored metrics between demos
- ⚠️ **Dashboard refresh** - Dashboards refresh every 5 seconds; Artillery panels trail the run by up to about 20 seconds
- ⚠️ **Browser tabs** - Close unused tabs to avoid memory issues
- ⚠️ **Container resources** - Ensure Docker has enough CPU/RAM
- ⚠️ **Concurrent tests** - k6 and Artillery write different measurements, but running both at once sends their load to the same toy API, which makes each result harder to read

---

## Related Documentation

- 📖 [Usage Guide](./USAGE.md) - CLI commands and workflows
- 🎯 [Dashboards](./DASHBOARDS.md) - Grafana dashboard details
- 🔧 [Troubleshooting](./TROUBLESHOOTING.md) - Common issues
- 🏗️ [Setup](./SETUP.md) - Installation and configuration
- 📈 [Artillery and InfluxDB](./ARTILLERY_INFLUXDB_GUIDE.md) - How Artillery's metrics reach the dashboards
- 🏠 [Main README](../README.md) and [CLI Documentation](../cli/README.md)
- 🧸 [Toy API endpoints](../toy-api/src/README.md)
- 💬 Chaos command help: `ltlab chaos --help`
- 📝 [Blog: Advanced Traffic Patterns and Chaos Testing](https://destbreso.com/blog/chaos-testing-under-load) - Article with practical examples and best practices

---

## License

MIT - See [LICENSE](../LICENSE) for details.
