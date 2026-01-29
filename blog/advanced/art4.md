# **Load Testing Lab – Understanding Metrics and Monitoring**

In the previous articles, we set up the **Load Testing Lab**, ran initial tests, and explored common load scenarios like steady traffic, spikes, ramp-ups, and realistic arrival patterns. While generating load is important, **understanding the results is equally critical**.

In this article, we dive into **metrics and monitoring**, showing how to interpret data from InfluxDB and Grafana, spot bottlenecks, and make informed decisions. By the end, you’ll know how to **read dashboards, set up alerts, and analyze system behavior** under load—without relying on any specific API or project context.

---

## **Getting Started with Metrics**

After running a test, you may notice several numbers and charts in Grafana: latency percentiles, throughput, error rates, and sometimes worker or queue metrics. These numbers can feel overwhelming at first, but each tells a story about your system’s performance.

Imagine running a steady load test with 50 concurrent users for 10 minutes. Your Grafana dashboard shows:

* p50 latency: 120ms
* p95 latency: 850ms
* p99 latency: 1.9s
* Throughput: 200 requests/sec
* Error rate: 0.5%

At first glance, everything seems fine, but the p99 value tells you that **a small fraction of requests are significantly slower**, which could indicate a rare bottleneck or slow backend operation. Metrics aren’t just numbers—they’re signals.

---

## **Latency Percentiles: p50, p95, p99**

Latency percentiles are key to understanding **how different portions of your traffic experience your service**.

* **p50** represents the median experience—half of requests are faster, half are slower. It gives a good baseline of normal operation.
* **p95** shows the experience of nearly all users (95% of requests). A sudden increase here can indicate system stress under moderately heavy load.
* **p99** highlights the extreme edge cases. Even if the median looks great, high p99 values may mean rare but critical issues exist.

**Scenario:** You run a spike test with 200 users ramping up over 2 minutes. Latency p50 remains low at 150ms, but p95 jumps to 1.2s and p99 hits 3s. This indicates that while most requests are handled fine, some users experience noticeable delays—a classic sign that your system’s resources are hitting saturation points.

---

## **Throughput: Requests per Second**

Throughput tells you **how much work your system can handle over time**. It’s not just about speed; it’s about volume. High latency with high throughput might be acceptable under peak conditions, but low throughput with increasing latency signals a problem.

**Example:** During a ramp-up test, throughput increases steadily until it plateaus at 300 RPS. Simultaneously, p95 latency rises sharply. This combination points to resource bottlenecks, like CPU or database saturation, and helps you decide whether scaling or optimization is needed.

---

## **Error Rate and Reliability**

Error rate is a straightforward but critical metric. Even a few percentage points of failed requests can indicate:

* Misconfigured endpoints
* Timeouts under load
* Worker or queue congestion

**Scenario:** Running a mixed-load scenario with varying traffic, you notice a 5% error rate during peak. While low, it’s worth investigating. Was a particular endpoint responsible? Did it correlate with a high latency spike? Grafana allows you to overlay errors on latency and throughput graphs, making correlation simple.

---

## **Worker and Queue Metrics**

For scenarios simulating background processing or async tasks, worker and queue metrics become essential. Monitoring queue depth and job latency helps you:

* Detect slow consumer threads or overloaded workers
* Identify patterns where jobs backlog under sustained load
* Ensure async workflows remain performant

**Scenario:** In a long-running test, queue depth spikes at certain intervals. P95 job completion latency jumps accordingly. This signals the need to **scale workers or optimize processing logic**—even before this would affect end users.

---

## **Customizing Grafana Dashboards**

Load Testing Lab comes with prebuilt dashboards, but customization is key:

* Add panels for specific endpoints, scenarios, or job types
* Overlay latency, throughput, and error rates to see correlations
* Annotate test start and end points to contextualize results
**Working with the Pre-configured Dashboards:**

Load Testing Lab includes 6 ready-to-use dashboards:

**k6 Dashboards:**
* `k6-dashboard` - Quick overview with essential metrics
* `k6-elite` - Detailed percentile analysis (p50, p75, p90, p95, p99)
* `k6-pro` - Professional view with trends and comparisons

**Artillery Dashboards:**
* `artillery-telegraf` - Basic metrics via Telegraf/StatsD bridge
* `artillery-elite` - Advanced Artillery metrics
* `artillery-pro` - Professional Artillery analysis

All dashboards:
* Auto-refresh every 5 seconds
* Use Flux queries (InfluxDB v2)
* Connect to datasource UID: `influxdb`
* Show latency percentiles, throughput, error rates

**Accessing dashboards:**

1. Open http://localhost:3000
2. Navigate to Dashboards → Browse
3. Find dashboards by name or UID
4. Use time range selector to focus on specific test runs

**Customizing dashboards:**

* Edit any panel to adjust queries or visualizations
* Save custom versions with new UIDs
* Export/import JSON for sharing across teams
* Use variables to switch between different tests or environments

Custom dashboards make your lab flexible, allowing you to **reuse it across multiple projects** without rewriting anything.

---

## **Setting Up Alerts**

Grafana can proactively notify you when performance degrades. Here's how to create alerts based on Load Testing Lab metrics:

**Example 1: High Latency Alert**

Trigger when p95 latency exceeds 500ms:

```flux
from(bucket: "loadtests")
  |> range(start: -5m)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: 1m, fn: quantile, column: "_value", q: 0.95)
  |> filter(fn: (r) => r._value > 500)
```

Set alert condition: "When query returns results for 2 minutes"

**Example 2: Error Rate Alert**

Trigger if failed requests exceed 3%:

```flux  
from(bucket: "loadtests")
  |> range(start: -5m)
  |> filter(fn: (r) => r["_measurement"] == "http_req_failed")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: 1m, fn: mean)
  |> map(fn: (r) => ({ r with _value: r._value * 100.0 }))
  |> filter(fn: (r) => r._value > 3.0)
```

**Example 3: Throughput Drop Alert**

Detect when requests/sec drops below threshold:

```flux
from(bucket: "loadtests")
  |> range(start: -5m)  
  |> filter(fn: (r) => r["_measurement"] == "http_reqs")
  |> filter(fn: (r) => r["_field"] == "value")
  |> derivative(unit: 1s, nonNegative: true)
  |> filter(fn: (r) => r._value < 50.0)
```

**Notification channels:**

* Slack webhook for team notifications
* Email for critical alerts
* PagerDuty for on-call escalation
* Discord/Teams for development teams

These alerts allow you to **catch regressions or issues automatically**, even while running multiple test scenarios in parallel.

---

## **Analyzing a Bottleneck Scenario**

Imagine a test where you gradually increase load to simulate real-world traffic:

1. Start with 10 virtual users, ramp to 100 over 5 minutes
2. Observe dashboards: median latency remains steady, but p95 and p99 spike
3. Throughput plateaus while errors start to appear
4. Worker queues begin growing (if simulated)

**Interpretation:** The system handles average requests well, but rare slow requests and rising queue depth indicate resource contention. This tells you where optimization or scaling is needed before it affects production.

---

## **Practical Tips**

1. Always **correlate latency, throughput, and error rate** to get the full picture.
2. Use **dashboard annotations** to mark test phases.
3. Automate alerts for quick feedback.
4. Keep tests **isolated from production**; metrics only matter if they reflect controlled scenarios.
5. Store results for **comparative analysis** across different runs or configurations.

---

## **Extending Metrics with Custom Measurements**

While standard metrics (latency, throughput, errors) are essential, **your application likely has domain-specific metrics** that matter to your business. The Load Testing Lab **fully supports custom metrics** that you define in your k6 scripts.

### **Why Custom Metrics Matter**

Standard HTTP metrics tell you **how fast** your API responds, but not always **what it's doing** or **how much it costs**. Custom metrics bridge this gap:

* **LLM/AI APIs**: Token counts, model processing time, cost per request
* **E-commerce**: Conversion rates, cart abandonment, order values
* **Microservices**: External API latency, cache hit rates, queue depths
* **Databases**: Query execution time by type, connection pool saturation
* **Resource Costs**: Memory per request, CPU cycles, I/O operations

**All custom metrics automatically flow to InfluxDB and can be visualized in Grafana.**

### **Creating Custom Metrics in k6**

k6 provides several metric types for capturing custom data:

**Example 1: Tracking LLM API Costs**

```javascript
import http from 'k6/http';
import { Trend, Counter } from 'k6/metrics';

// Define custom metrics
const tokenCount = new Trend('llm_token_count');
const requestCost = new Trend('llm_request_cost');
const modelCalls = new Counter('llm_model_calls');

export default function () {
  const res = http.post('https://api.openai.com/v1/completions', 
    JSON.stringify({
      model: 'gpt-4',
      prompt: 'Explain load testing',
      max_tokens: 100
    }), 
    { headers: { 'Authorization': 'Bearer YOUR_TOKEN' } }
  );
  
  // Parse response payload
  const data = JSON.parse(res.body);
  const tokens = data.usage?.total_tokens || 0;
  const cost = tokens * 0.00003; // $0.03 per 1K tokens
  
  // Track custom metrics
  tokenCount.add(tokens);
  requestCost.add(cost);
  modelCalls.add(1);
}
```

These metrics appear in InfluxDB as:
- `llm_token_count` (trend values)
- `llm_request_cost` (cost values)
- `llm_model_calls` (counter)

**Example 2: Tracking Business Conversions**

```javascript
import { Rate, Trend } from 'k6/metrics';

const conversionRate = new Rate('user_conversions');
const orderValue = new Trend('order_value_usd');
const cartAbandonment = new Counter('cart_abandonments');

export default function () {
  // Simulate user journey
  const cartRes = http.post('http://api.example.com/cart/add', /* ... */);
  const checkoutRes = http.post('http://api.example.com/checkout', /* ... */);
  
  const checkoutData = JSON.parse(checkoutRes.body);
  
  // Track conversion
  conversionRate.add(checkoutData.success ? 1 : 0);
  
  if (checkoutData.success) {
    orderValue.add(checkoutData.total_amount);
  } else {
    cartAbandonment.add(1);
  }
}
```

**Example 3: Tracking External Service Performance**

```javascript
const externalApiLatency = new Trend('external_api_latency_ms');
const cacheHitRate = new Rate('cache_hits');
const queueDepth = new Gauge('worker_queue_depth');

export default function () {
  const res = http.get('http://my-api.com/data');
  const payload = JSON.parse(res.body);
  
  // Extract metrics from response payload
  if (payload.external_service_time_ms) {
    externalApiLatency.add(payload.external_service_time_ms);
  }
  
  // Track cache behavior
  cacheHitRate.add(payload.cache_hit ? 1 : 0);
  
  // Monitor queue depth
  if (payload.queue_depth !== undefined) {
    queueDepth.add(payload.queue_depth);
  }
}
```

### **Visualizing Custom Metrics in Grafana**

Once your custom metrics flow into InfluxDB, create dedicated dashboards:

**Step 1: Query Custom Metrics**

In Grafana, use Flux queries to access your custom measurements:

```flux
// Total API cost
from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "llm_request_cost")
  |> filter(fn: (r) => r["_field"] == "value")
  |> sum()

// Average tokens per request
from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "llm_token_count")
  |> filter(fn: (r) => r["_field"] == "value")
  |> mean()

// Cache hit rate percentage
from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "cache_hits")
  |> filter(fn: (r) => r["_field"] == "value")
  |> mean()
  |> map(fn: (r) => ({ r with _value: r._value * 100.0 }))
```

**Step 2: Create Dashboard Panels**

Create panels that make sense for your metrics:

* **Stat panels**: Show totals (total cost, total tokens, conversion rate)
* **Time series**: Show trends over test duration
* **Gauges**: Display current values with thresholds (queue depth, error rate)
* **Bar gauges**: Compare values across dimensions (cost by endpoint)
* **Tables**: Show detailed breakdowns

**Step 3: Save and Provision**

Export your dashboard as JSON and save to `grafana/dashboards/my-custom-dashboard.json`. It will auto-load on next Grafana restart.

### **Real-World Custom Dashboard Examples**

**LLM API Performance Dashboard:**
- Total API cost ($)
- Average cost per request
- Token usage over time
- Model response latency vs token count
- Cost efficiency (tokens per dollar)

**E-commerce Dashboard:**
- Conversion rate by traffic level
- Average order value trends
- Cart abandonment correlation with page latency
- Payment processing success rate
- Revenue per second during test

**Microservices Health:**
- External API latency breakdown by service
- Cache hit ratio vs response time
- Queue depth and worker utilization
- Circuit breaker activation frequency
- Retry distribution across endpoints

### **Best Practices for Custom Metrics**

1. **Name clearly**: Use `payment_processing_time_ms` not `metric_1`
2. **Choose correct types**: 
   - **Trend** for durations, sizes, counts
   - **Rate** for success/failure percentages
   - **Counter** for cumulative totals
   - **Gauge** for current values
3. **Add units**: Specify ms, USD, bytes, percent in panel configuration
4. **Set thresholds**: Color-code based on business SLAs
5. **Correlate with standard metrics**: Overlay custom metrics with latency/errors
6. **Version control**: Keep dashboard JSON files in git
7. **Document formulas**: Explain how derived metrics are calculated

### **Advanced: Multi-Environment Custom Metrics**

You can track environment-specific metrics using tags:

```javascript
import { Trend } from 'k6/metrics';
import exec from 'k6/execution';

const apiLatency = new Trend('api_latency', true); // true enables tags

export default function () {
  const res = http.get('http://api.example.com/endpoint');
  
  // Add tags for filtering in Grafana
  apiLatency.add(res.timings.duration, {
    environment: __ENV.ENVIRONMENT || 'staging',
    region: __ENV.REGION || 'us-east-1',
    endpoint: '/endpoint'
  });
}
```

Then in Grafana, filter by tags:

```flux
from(bucket: "loadtests")
  |> range(start: v.timeRangeStart)
  |> filter(fn: (r) => r["_measurement"] == "api_latency")
  |> filter(fn: (r) => r["environment"] == "production")
  |> filter(fn: (r) => r["region"] == "us-east-1")
```

**The Load Testing Lab provides the infrastructure; you define the metrics that matter to your business.**

---

## **Conclusion**

Understanding metrics is where Load Testing Lab really shines. You're not just **generating load**—you're collecting actionable insights about system behavior under stress. With Grafana dashboards, alerting, and **custom metrics for domain-specific analysis**, you can **detect bottlenecks, interpret performance trends, and plan improvements confidently**.

Whether you're tracking standard HTTP metrics or specialized business KPIs like LLM costs, conversion rates, or microservice health, the lab **adapts to your needs**.

In the next article, we’ll explore **advanced techniques**, like **multi-environment setups, CI/CD integration, automated reporting, and custom scenario libraries**, taking your load testing capabilities to a professional level.
