# **Load Testing Lab – Dashboard Customization & Custom Metrics**
**Part of:** [Load Testing Lab Series](art0.md) | **Bonus Article** 🎨

**Estimated reading time:** 12–15 minutes

---

> 🎯 **In this article:** Learn how to extend the Load Testing Lab with custom metrics tailored to your specific business needs. We'll show you how to track LLM API costs, e-commerce conversions, microservice health, and any domain-specific metric that matters to your application.

---

## **Why Custom Metrics Matter**

The pre-built dashboards in Load Testing Lab provide **standard HTTP performance metrics**:

* Request latency (p50, p95, p99)
* Throughput (requests per second)
* Error rates
* Active virtual users
* Bandwidth usage

These are essential for understanding **how your system performs**, but they don't tell you **what your application is actually doing** or **how much it costs**.

**Real-world scenarios where standard metrics aren't enough:**

* **LLM/AI APIs**: How many tokens are you consuming? What's the cost per request? How does load affect token throughput?
* **E-commerce**: What's your conversion rate under stress? How does latency impact cart abandonment?
* **Microservices**: Which external service is the bottleneck? What's your cache hit rate?
* **Database-heavy apps**: How many queries per request? What's the connection pool saturation?
* **Background workers**: How deep are your queues? What's the worker utilization rate?

**The Load Testing Lab is designed for extension and personalization.** You can capture any metric from your API responses and visualize them in Grafana.

---

## **How Custom Metrics Work**

The flow is simple:

```
┌─────────────────────────────────────────────────────┐
│  1. Define custom metrics in k6 script              │
│     - Track tokens, costs, conversions, etc.        │
└──────────────────┬──────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────┐
│  2. k6 automatically sends metrics to InfluxDB      │
│     - Through xk6-influxdb integration              │
└──────────────────┬──────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────┐
│  3. Create Grafana dashboard to visualize           │
│     - Use Flux queries to access custom metrics     │
└─────────────────────────────────────────────────────┘
```

**No additional configuration needed** – custom metrics automatically flow through the existing pipeline.

---

## **Example 1: Tracking LLM API Costs**

Let's track token usage and costs from an LLM API like OpenAI GPT-4:

**k6 Script: `k6/scenarios/llm-cost-tracking.js`**

```javascript
import http from 'k6/http';
import { Trend, Counter } from 'k6/metrics';
import { sleep } from 'k6';

// Define custom metrics
const tokenCount = new Trend('llm_token_count');
const requestCost = new Trend('llm_request_cost_usd');
const modelCalls = new Counter('llm_total_calls');
const promptTokens = new Trend('llm_prompt_tokens');
const completionTokens = new Trend('llm_completion_tokens');

export const options = {
  vus: 10,
  duration: '2m',
};

export default function () {
  const payload = JSON.stringify({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Explain load testing in 50 words.' }
    ],
    max_tokens: 100
  });
  
  const res = http.post(
    'https://api.openai.com/v1/chat/completions',
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${__ENV.OPENAI_API_KEY}`
      }
    }
  );
  
  // Parse response
  if (res.status === 200) {
    const data = JSON.parse(res.body);
    
    // Extract token usage
    const usage = data.usage || {};
    const totalTokens = usage.total_tokens || 0;
    const promptToks = usage.prompt_tokens || 0;
    const completionToks = usage.completion_tokens || 0;
    
    // Calculate cost (GPT-4 pricing as of 2024)
    const promptCost = (promptToks / 1000) * 0.03;  // $0.03 per 1K prompt tokens
    const completionCost = (completionToks / 1000) * 0.06;  // $0.06 per 1K completion tokens
    const totalCost = promptCost + completionCost;
    
    // Track all metrics
    tokenCount.add(totalTokens);
    promptTokens.add(promptToks);
    completionTokens.add(completionToks);
    requestCost.add(totalCost);
    modelCalls.add(1);
  }
  
  sleep(1);
}
```

**Running the test:**

```bash
export OPENAI_API_KEY=sk-...
ltlab k6 -s llm-cost-tracking.js
```

**What you're capturing:**

* Total tokens per request
* Prompt vs completion token breakdown
* Cost per request in USD
* Total number of API calls

---

## **Creating the LLM Cost Dashboard**

Now visualize these metrics in Grafana.

**Dashboard JSON: `grafana/dashboards/llm-cost-dashboard.json`**

```json
{
  "title": "LLM API Cost & Performance",
  "uid": "llm-costs",
  "schemaVersion": 38,
  "version": 1,
  "refresh": "5s",
  "tags": ["llm", "ai", "openai", "cost-analysis", "custom"],
  "time": { "from": "now-30m", "to": "now" },
  "panels": [
    {
      "type": "stat",
      "title": "Total API Cost ($)",
      "gridPos": { "x": 0, "y": 0, "w": 6, "h": 5 },
      "datasource": { "type": "influxdb", "uid": "influxdb" },
      "targets": [{
        "query": "from(bucket: \"loadtests\")\\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\\n  |> filter(fn: (r) => r[\\\"_measurement\\\"] == \\\"llm_request_cost_usd\\\")\\n  |> filter(fn: (r) => r[\\\"_field\\\"] == \\\"value\\\")\\n  |> sum()",
        "refId": "A"
      }],
      "fieldConfig": {
        "defaults": {
          "unit": "currencyUSD",
          "decimals": 4,
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 10 },
              { "color": "orange", "value": 25 },
              { "color": "red", "value": 50 }
            ]
          }
        }
      },
      "options": {
        "colorMode": "background",
        "graphMode": "area",
        "textMode": "value_and_name"
      }
    },
    {
      "type": "stat",
      "title": "Average Cost Per Request",
      "gridPos": { "x": 6, "y": 0, "w": 6, "h": 5 },
      "datasource": { "type": "influxdb", "uid": "influxdb" },
      "targets": [{
        "query": "from(bucket: \"loadtests\")\\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\\n  |> filter(fn: (r) => r[\\\"_measurement\\\"] == \\\"llm_request_cost_usd\\\")\\n  |> filter(fn: (r) => r[\\\"_field\\\"] == \\\"value\\\")\\n  |> mean()",
        "refId": "B"
      }],
      "fieldConfig": {
        "defaults": {
          "unit": "currencyUSD",
          "decimals": 6
        }
      },
      "options": {
        "colorMode": "value",
        "graphMode": "none",
        "textMode": "value_and_name"
      }
    },
    {
      "type": "stat",
      "title": "Total Tokens Consumed",
      "gridPos": { "x": 12, "y": 0, "w": 6, "h": 5 },
      "datasource": { "type": "influxdb", "uid": "influxdb" },
      "targets": [{
        "query": "from(bucket: \"loadtests\")\\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\\n  |> filter(fn: (r) => r[\\\"_measurement\\\"] == \\\"llm_token_count\\\")\\n  |> filter(fn: (r) => r[\\\"_field\\\"] == \\\"value\\\")\\n  |> sum()",
        "refId": "C"
      }],
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "decimals": 0
        }
      }
    },
    {
      "type": "stat",
      "title": "Total API Calls",
      "gridPos": { "x": 18, "y": 0, "w": 6, "h": 5 },
      "datasource": { "type": "influxdb", "uid": "influxdb" },
      "targets": [{
        "query": "from(bucket: \"loadtests\")\\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\\n  |> filter(fn: (r) => r[\\\"_measurement\\\"] == \\\"llm_total_calls\\\")\\n  |> filter(fn: (r) => r[\\\"_field\\\"] == \\\"value\\\")\\n  |> sum()",
        "refId": "D"
      }]
    },
    {
      "type": "timeseries",
      "title": "Token Usage Over Time",
      "gridPos": { "x": 0, "y": 5, "w": 12, "h": 8 },
      "datasource": { "type": "influxdb", "uid": "influxdb" },
      "targets": [
        {
          "query": "from(bucket: \"loadtests\")\\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\\n  |> filter(fn: (r) => r[\\\"_measurement\\\"] == \\\"llm_prompt_tokens\\\")\\n  |> filter(fn: (r) => r[\\\"_field\\\"] == \\\"value\\\")\\n  |> aggregateWindow(every: v.windowPeriod, fn: sum, createEmpty: false)",
          "refId": "E"
        },
        {
          "query": "from(bucket: \"loadtests\")\\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\\n  |> filter(fn: (r) => r[\\\"_measurement\\\"] == \\\"llm_completion_tokens\\\")\\n  |> filter(fn: (r) => r[\\\"_field\\\"] == \\\"value\\\")\\n  |> aggregateWindow(every: v.windowPeriod, fn: sum, createEmpty: false)",
          "refId": "F"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "custom": {
            "drawStyle": "line",
            "lineWidth": 2,
            "fillOpacity": 20
          }
        }
      }
    },
    {
      "type": "timeseries",
      "title": "Cost Per Request Over Time",
      "gridPos": { "x": 12, "y": 5, "w": 12, "h": 8 },
      "datasource": { "type": "influxdb", "uid": "influxdb" },
      "targets": [{
        "query": "from(bucket: \"loadtests\")\\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\\n  |> filter(fn: (r) => r[\\\"_measurement\\\"] == \\\"llm_request_cost_usd\\\")\\n  |> filter(fn: (r) => r[\\\"_field\\\"] == \\\"value\\\")\\n  |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)",
        "refId": "G"
      }],
      "fieldConfig": {
        "defaults": {
          "unit": "currencyUSD",
          "decimals": 6,
          "custom": {
            "drawStyle": "line",
            "lineWidth": 2
          }
        }
      }
    }
  ]
}
```

**Load the dashboard:**

```bash
ltlab restart -s grafana
```

**Access:** http://localhost:3081/d/llm-costs

---

## **Example 2: E-commerce Conversion Tracking**

Track business metrics like conversion rates and order values under load:

```javascript
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';

const conversionRate = new Rate('ecommerce_conversions');
const orderValue = new Trend('ecommerce_order_value_usd');
const cartAbandonment = new Counter('ecommerce_cart_abandonments');
const checkoutLatency = new Trend('ecommerce_checkout_latency_ms');

export default function () {
  // Add to cart
  const cartRes = http.post('http://api.example.com/cart', /* ... */);
  
  // Proceed to checkout
  const checkoutStart = Date.now();
  const checkoutRes = http.post('http://api.example.com/checkout', /* ... */);
  const checkoutTime = Date.now() - checkoutStart;
  
  checkoutLatency.add(checkoutTime);
  
  const data = JSON.parse(checkoutRes.body);
  
  if (data.success) {
    conversionRate.add(1);
    orderValue.add(data.total_amount);
  } else {
    conversionRate.add(0);
    cartAbandonment.add(1);
  }
}
```

**Dashboard panels show:**
- Conversion rate (%)
- Average order value
- Cart abandonment count
- Checkout latency vs conversion correlation

---

## **Example 3: Microservice Health Monitoring**

Track external dependencies and caching:

```javascript
import { Trend, Rate, Gauge } from 'k6/metrics';

const externalApiLatency = new Trend('external_service_latency_ms');
const cacheHitRate = new Rate('cache_hits');
const queueDepth = new Gauge('worker_queue_depth');
const dbQueryTime = new Trend('database_query_time_ms');

export default function () {
  const res = http.get('http://my-api.com/data');
  const payload = JSON.parse(res.body);
  
  // Track external service timing
  if (payload.external_service_time_ms) {
    externalApiLatency.add(payload.external_service_time_ms);
  }
  
  // Track cache performance
  cacheHitRate.add(payload.cache_hit ? 1 : 0);
  
  // Monitor queue depth
  if (payload.queue_depth !== undefined) {
    queueDepth.add(payload.queue_depth);
  }
  
  // Track database performance
  if (payload.db_query_time_ms) {
    dbQueryTime.add(payload.db_query_time_ms);
  }
}
```

---

## **Best Practices for Custom Dashboards**

### **1. Metric Naming Conventions**

✅ **Good**: `llm_token_count`, `api_cost_usd`, `checkout_latency_ms`  
❌ **Bad**: `metric1`, `data`, `value`

Use descriptive names with units in the name.

### **2. Choose the Right Metric Type**

| Metric Type | Use Case | Example |
|-------------|----------|---------|
| **Trend** | Durations, sizes, counts that vary | Latency, tokens, bytes |
| **Rate** | Success/failure percentages | Conversion rate, cache hits |
| **Counter** | Cumulative totals | Total requests, errors |
| **Gauge** | Current snapshot values | Queue depth, active connections |

### **3. Set Meaningful Thresholds**

Base thresholds on **business SLAs**, not arbitrary values:

```json
"thresholds": {
  "steps": [
    { "color": "green", "value": null },
    { "color": "yellow", "value": 0.01 },  // $0.01 warning
    { "color": "red", "value": 0.05 }     // $0.05 critical
  ]
}
```

### **4. Correlate Custom with Standard Metrics**

Create panels that show relationships:
- Cost per request vs latency
- Conversion rate vs error rate
- Token usage vs throughput

### **5. Use Tags for Multi-Dimensional Analysis**

```javascript
const apiLatency = new Trend('api_latency', true); // enable tags

export default function () {
  const res = http.get('http://api.com/endpoint');
  
  apiLatency.add(res.timings.duration, {
    endpoint: '/endpoint',
    region: __ENV.REGION || 'us-east-1',
    environment: __ENV.ENV || 'staging'
  });
}
```

Filter in Grafana by tags:

```flux
from(bucket: "loadtests")
  |> filter(fn: (r) => r["endpoint"] == "/checkout")
  |> filter(fn: (r) => r["region"] == "us-east-1")
```

---

## **Real-World Dashboard Gallery**

### **LLM/AI Performance Dashboard**
- Total API cost
- Cost per request trend
- Token usage (prompt vs completion)
- Model response latency
- Cost efficiency (tokens per dollar)
- API quota utilization

### **E-commerce Business Dashboard**
- Conversion rate by load level
- Average order value
- Cart abandonment vs page latency
- Payment success rate
- Revenue per second
- Checkout funnel drop-off

### **Microservices Health Dashboard**
- External API latency by service
- Cache hit rate vs response time
- Queue depth and worker saturation
- Circuit breaker activations
- Retry distribution
- Database connection pool usage

### **Cost Optimization Dashboard**
- Cost per request by endpoint
- Resource utilization vs throughput
- Scaling efficiency
- Peak vs off-peak comparison
- Cost forecast projections

---

## **Quick Start Workflow**

1. **Add custom metrics** to your k6 script (Trend, Rate, Counter, Gauge)
2. **Run test**: `ltlab k6 -s your-script.js`
3. **Create dashboard** in Grafana UI (easier than JSON editing)
4. **Export JSON** from Grafana dashboard settings
5. **Save** to `grafana/dashboards/your-dashboard.json`
6. **Restart Grafana**: `ltlab restart -s grafana`
7. **Dashboard auto-provisions** on future starts ✅

---

## **Conclusion**

The Load Testing Lab's power lies in its **extensibility**. While standard HTTP metrics tell you **how fast** your system is, **custom metrics tell you what it's actually doing** and **how much it costs**.

Whether you're:
- Tracking LLM token usage and costs
- Measuring e-commerce conversions under load
- Monitoring microservice dependencies
- Analyzing database performance
- Optimizing cloud resource costs

**The lab adapts to your needs.** You define the metrics that matter to your business, and Grafana visualizes them.

### 📊 About the Included Dashboards

The pre-built dashboards serve two purposes:

1. **General "Ready to Use"**: Work for any API without modification (standard HTTP metrics)
2. **Reference & Guide**: Examples of panels, queries, and patterns you can reuse

**For complex or highly specialized dashboards**, use:
- [Official Grafana Documentation](https://grafana.com/docs/)
- [Flux Query Guide](https://docs.influxdata.com/flux/)
- [Grafana Community](https://grafana.com/grafana/dashboards/)

### 🔀 Customization vs Contribution

- **Fork/download for your needs**: Custom dashboards don't need to be contributed back
- **Contribute if generalizable**: Dashboards useful for many (e.g., "WebSocket Metrics") make great PRs
- **Included dashboards are starting points**: Use as-is or adapt freely

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

**The infrastructure is provided; the insights are yours to discover.**

---

## **Keeping Dashboards in Your Project (External Projects)**

When working on real projects, you'll want to keep custom dashboards **alongside your API code** - not inside the lab. This way:

- Your dashboards are versioned with your project
- The lab remains clean and generic
- Multiple team members can share the same dashboards

### **The Workflow**

```bash
# 1. Create dashboards in your project
my-api/
  src/
  tests/
    load/
      scenarios/       # k6 test files
      dashboards/      # Custom Grafana dashboards
        my-api-metrics.json
        llm-cost-tracker.json
```

```bash
# 2. Link dashboards to the lab (copies to custom/ folder)
cd ~/projects/my-api
ltlab dashboard link ./tests/load/dashboards

# 3. Restart Grafana to load them
ltlab restart -s grafana

# 4. View in Grafana - dashboards appear under "custom" folder
open http://localhost:3000
```

### **Keeping in Sync**

Your project folder is the **source of truth**. When you update a dashboard:

```bash
# After editing dashboards in your project
ltlab dashboard link ./tests/load/dashboards
ltlab restart -s grafana
```

### **Why This Works**

- The lab's `custom/` folder is **ignored by git**
- Your project tracks the dashboards in its own repo
- No duplication or sync issues
- Works across teams and machines

### **Complete Example**

```bash
# Your e-commerce API project
cd ~/projects/ecommerce-api

# Run load tests with your scenarios
ltlab k6 -p ./tests/load -s checkout-flow.js

# Add your custom conversion dashboard
ltlab dashboard link ./tests/load/dashboards

# Restart and view
ltlab restart -s grafana
open http://localhost:3000
```

**📚 Full guide:** [External Projects Guide](../../docs/EXTERNAL_PROJECTS.md)

---

**Next Steps:**
- Explore [CI/CD Integration (art5)](art5.md) for automated custom metric tracking
- Review [Performance Optimization (art8)](art8.md) using custom metrics to drive improvements
- Check [Cross-Ecosystem Strategies (art9)](art9.md) for integrating with Datadog, Sentry, etc.

---

**Made with ❤️ for the developer community**
