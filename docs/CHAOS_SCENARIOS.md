# Chaos Engineering Scenarios

Chaos scenarios are designed for **chaos engineering testing against the toy-api**. They're perfect for:

- 📚 **Teaching and tutorials** - Help beginners understand load testing metrics
- 🎯 **Dashboard testing** - Verify your Grafana dashboards display correctly
- 🎓 **Demos** - Show load testing concepts without external APIs
- 🧪 **Learning chaos engineering** - Understand system behavior under failures
- 👨‍🏫 **Training** - Explain testing concepts to non-technical people

Both **k6** and **Artillery** have chaos scenarios that test the same endpoints with different approaches.

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
- Duration: 30s ramp-up → 1min sustained → 20s ramp-down
- Target: 20 VUs with weighted endpoint selection
- Custom metrics: error rate, timeout rate
- Threshold: p95 < 3s, error rate < 50%

**Artillery Implementation:**
- Phases: 30s ramp (10 RPS) → 60s sustained (20 RPS) → 20s cool down (5 RPS)
- Scenario weighting for endpoint distribution
- Think time between requests for realistic behavior
- StatsD metrics to Telegraf

**Perfect for:** Learning to interpret mixed failure patterns in dashboards.

**Run with:**
```bash
# k6
ltlab chaos -e k6     # Interactive selector
ltlab k6 -s chaos-basic.js

# Artillery
ltlab chaos -e artillery
ltlab artillery -s chaos-basic.yml
```

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
- Duration: 20s normal → 30s spike → 40s sustained → 30s recovery → 20s cool down
- VUs: 10 → 50 (sudden increase)
- Custom metrics: error rate, timeout rate, recovery time
- Threshold: p99 < 5s, error rate < 60%

**Artillery Implementation:**
- Phases: 20s normal (5 RPS) → 30s spike (30 RPS) → 40s sustained → 30s recovery
- Two scenarios: "Everything Goes Wrong" + "Rapid Fire Chaos"
- Rapid-fire requests with minimal think time
- Threshold: p99 < 5s, error rate < 60%

**Perfect for:** Understanding system behavior under traffic spikes and simultaneous stress.

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
- Hits `/error` endpoint with retry logic
- Exponential backoff: 0.5s, 1s, 2s
- Max 3 retry attempts
- Duration: 1min ramp-up → 3min sustained → 30s ramp-down
- Target: 30 VUs
- Custom metrics: retry counter
- Threshold: p90 < 4s, error rate < 40%, retries < 1000

**Artillery Implementation:**
- Two scenarios: "Retry Logic Testing" + "Mixed Reliability"
- Sequential calls with wait times between attempts
- Tests both fast and slow endpoints
- Phases: 60s gradual ramp (15 RPS) → 180s sustained (20 RPS) → 30s cool down
- Threshold: p95 < 4s, error rate < 40%

**Perfect for:** Learning how to handle errors gracefully and measure recovery effectiveness.

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

## What You'll Learn

### Load Testing Fundamentals
- **Request Distribution** - How different endpoints affect overall metrics
- **Error Handling** - When and why errors occur
- **Response Times** - How latency impacts user experience
- **Resource Usage** - CPU and I/O bottleneck patterns
- **Recovery Patterns** - How systems recover after stress
- **Retry Mechanisms** - Exponential backoff and retry strategies

### Chaos Engineering Principles
- **Controlled Failures** - Introduce faults in safe environment
- **Baseline vs Chaos** - Compare normal vs stressed behavior
- **Observability** - Monitor what happens during chaos
- **Resilience Testing** - Verify error handling works
- **Gradual Stress** - Understand breaking points

### Metrics Interpretation
- **HTTP metrics** - Success rate, request rate, response times
- **Percentiles** - p50, p90, p95, p99 meaning
- **Error rates** - Acceptable vs critical thresholds
- **Custom metrics** - Tracking specific behaviors (retries, timeouts)
- **Trend analysis** - How metrics evolve over time

---

## Using with Grafana

All chaos scenarios produce rich metrics visible in Grafana dashboards:

### k6 Metrics Flow
```
k6 → InfluxDB v2 → Grafana
```

**Available Dashboards:**
- **k6 Load Testing Results** - HTTP metrics, VUs, data transfer
- **k6 Performance Testing** - Percentiles, checks, trends
- **k6 Prometheus** - Resource usage and custom metrics

### Artillery Metrics Flow
```
Artillery → StatsD → Telegraf → InfluxDB v2 → Grafana
```

**Available Dashboards:**
- **Artillery Performance** - HTTP metrics, response times, error rates
- **Artillery Scenarios** - Scenario-specific metrics
- **StatsD Telegraf** - Custom metrics and request distribution

### Recommended Viewing
1. Start chaos scenario
2. Open relevant Grafana dashboard (auto-opens with `ltlab`)
3. Watch metrics in real-time
4. Identify patterns during ramp-up, sustained load, and recovery
5. Compare behavior across different chaos types

### Key Panels to Watch
- **Request Rate** - See traffic patterns (spikes, sustained load)
- **Response Time Distribution** - p95/p99 during chaos
- **Error Rate** - Track failures during stress
- **Active VUs/RPS** - Correlate load with response times
- **Custom Metrics** - Retries, timeouts, specific endpoint behavior

---

## k6 vs Artillery: Choosing the Right Tool

Both engines can run chaos scenarios, but they have different strengths:

### k6 Strengths
- **JavaScript-based** - Familiar syntax for developers
- **Rich scripting** - Complex logic, conditionals, custom functions
- **Custom metrics** - Define your own counters and trends
- **Thresholds** - Built-in pass/fail criteria
- **Checks** - In-script assertions
- **Cloud integration** - Grafana k6 Cloud support
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
- **Plugins** - Extensive ecosystem (AWS, Slack, etc.)
- **Expectations** - Simple pass/fail conditions

**Best for:**
- Non-developers (QA, DevOps)
- Quick scenario creation
- Realistic user behavior simulation
- Weight-based load distribution
- Teaching load testing basics

### Chaos Scenarios Comparison

| Feature                | k6                         | Artillery                 |
|------------------------|----------------------------|---------------------------|
| **Syntax**             | JavaScript                 | YAML                      |
| **VU/RPS control**     | VUs (virtual users)        | RPS (requests per second) |
| **Retry logic**        | Custom code                | Sequential calls + waits  |
| **Endpoint selection** | Weighted random            | Scenario weights          |
| **Custom metrics**     | `Trend`, `Counter`, `Rate` | StatsD tags               |
| **Thresholds**         | Built-in                   | Plugin-based              |
| **Think time**         | `sleep()` function         | `think: X` property       |
| **Complexity**         | More flexible              | More structured           |

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

All chaos scenarios target these local endpoints:

| Endpoint | Behavior            | Use Case            |
|----------|---------------------|---------------------|
| `/fast`  | Instant response    | Baseline (no chaos) |
| `/slow`  | 500-2500ms latency  | Latency testing     |
| `/error` | 30% random failures | Error handling      |
| `/cpu`   | CPU-intensive ops   | Resource stress     |
| `/io`    | I/O operations      | I/O bottleneck      |

**Why toy-api?**
- 🔒 **Safe** - No external dependencies
- 🎯 **Predictable** - Known failure rates
- 📚 **Educational** - Clear cause-effect relationships
- 🚀 **Fast** - Instant setup, no configuration
- 🎓 **Teaching-friendly** - Explain concepts without complexity

---

## Tips for Teaching & Demos

### Before Running Scenarios
1. Start toy-api: `ltlab toy start`
2. Open Grafana: `http://localhost:3003`
3. Explain chaos engineering concepts
4. Show endpoint behaviors (optional: `curl http://localhost:8080/fast`)

### During Scenarios
1. Run chaos scenario: `ltlab chaos`
2. Watch Grafana dashboards in real-time
3. Point out key metrics as they change
4. Explain why certain patterns appear
5. Show correlation between load and response times

### After Scenarios
1. Review final dashboard state
2. Compare normal vs chaos behavior
3. Discuss what worked/failed
4. Explain recovery patterns
5. Show how to interpret percentiles

### Common Teaching Points
- **Why p95/p99 matter** - Most users won't experience p50
- **Error budgets** - 1% error rate = 7+ hours downtime/month
- **Retry storms** - Aggressive retries can worsen failures
- **Graceful degradation** - Systems should handle load gracefully
- **Observability** - Can't fix what you can't measure

### Demo Gotchas
- ⚠️ **InfluxDB retention** - Data kept for 30 days by default
- ⚠️ **Dashboard refresh** - Set to 5s for live updates
- ⚠️ **Browser tabs** - Close unused tabs to avoid memory issues
- ⚠️ **Container resources** - Ensure Docker has enough CPU/RAM
- ⚠️ **Concurrent tests** - Don't run k6 + Artillery simultaneously (metrics collision)

---

## Related Documentation

- 📖 [Usage Guide](./USAGE.md) - CLI commands and workflows
- 🎯 [Dashboards](./DASHBOARDS.md) - Grafana dashboard details
- 🔧 [Troubleshooting](./TROUBLESHOOTING.md) - Common issues
- 🏗️ [Setup](./SETUP.md) - Installation and configuration
- 🚀 [Testing Guide](./TESTING_GUIDE.md) - Complete testing workflows
- 🎓 [Chaos Testing Guide](./CHAOS_TESTING_GUIDE.md) - In-depth chaos engineering
- 📝 [Blog: Advanced Traffic Patterns and Chaos Testing](../blog/advanced/art7.md) - Article with practical examples and best practices

---

## License

MIT - See [LICENSE](../LICENSE) for details.

---

## What You'll Learn

By running these scenarios and observing the Grafana dashboards, you'll understand:

1. **Error Rate Patterns**
   - How error spikes appear in graphs
   - Difference between sustained vs intermittent errors
   - Impact of retry logic on error rates

2. **Response Time Metrics**
   - What p50, p95, p99 mean in practice
   - How latency affects different percentiles
   - Response time distribution under chaos

3. **Recovery Patterns**
   - How long systems take to stabilize
   - Visual indicators of recovery in metrics
   - Difference between graceful vs catastrophic degradation

4. **Resource Impact**
   - CPU-intensive operations on throughput
   - I/O bottlenecks visualization
   - Correlation between load and resource usage

5. **Dashboard Interpretation**
   - Which panels show which problems
   - How to spot issues quickly
   - Reading graphs under abnormal conditions

---

## Using with Grafana

After running chaos scenarios:

1. Open Grafana: http://localhost:3000
2. Go to k6 dashboards (k6-dashboard, k6-elite, or k6-pro)
3. Observe these panels:
   - **Request Rate** - Shows traffic patterns
   - **Error Rate** - Spikes during chaos
   - **Response Time** - p50/p95/p99 changes
   - **Success vs Failures** - Visual separation
   - **Request Duration Distribution** - Shape changes under chaos

---

## Target API Endpoints

These scenarios use the **toy-api** endpoints:

- `GET /fast` - Fast response (~10ms)
- `GET /slow` - Variable latency (500-2500ms)
- `GET /error` - 30% random failure rate
- `GET /cpu` - CPU-intensive operation
- `GET /io` - I/O operation with delays

**No external APIs needed!** Everything runs locally and safely.

---

## Tips for Teaching/Demos

1. **Start with chaos-basic** - Easiest to understand
2. **Run scenario while showing Grafana** - Real-time visualization
3. **Explain what's happening** - Point out patterns as they appear
4. **Compare before/after** - Show normal load first, then chaos
5. **Focus on one metric at a time** - Don't overwhelm beginners
6. **Use chaos-resilience** - To teach error handling best practices

---

## For More Information

- Main README: [../../README.md](../../README.md)
- CLI Documentation: [../../cli/README.md](../../cli/README.md)
- Toy API endpoints: [../../toy-api/src/README.md](../../toy-api/src/README.md)
- Chaos command help: `ltlab chaos --help`
