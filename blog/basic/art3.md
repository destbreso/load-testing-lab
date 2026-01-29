

# Article 3: Handling Common Load Testing Scenarios – Step by Step

**Introduction**

Now that you have your **Load Testing Lab** up and running (see Article 2), it’s time to explore **common testing scenarios** that most APIs and services encounter. The goal is to show **practical examples** of how to simulate realistic traffic, bursts, failures, and concurrency patterns. All scenarios are **general-purpose** and can be adapted to any API.

> ⚠️ Disclaimer: These examples are designed to be educational and reproducible. They are not exhaustive; each system may require custom tuning.

---

## Scenario 1: Gradual Ramp-Up

**Purpose:** Test how your API behaves as traffic increases over time.

**Steps:**

1. Configure `.env` for a longer duration and moderate concurrency:

```env
CONCURRENCY=100
DURATION=30m
```

2. Create a k6 scenario (`k6/scenarios/ramp-up.js`):

```js
import http from 'k6/http';
import { sleep } from 'k6';

export let options = {
  stages: [
    { duration: '5m', target: 10 },
    { duration: '10m', target: 50 },
    { duration: '10m', target: 100 },
    { duration: '5m', target: 0 },
  ],
};

export default function () {
  http.get(`${__ENV.TARGET_API_URL}/`);
  sleep(Math.random() * 3);
}
```

3. Run the scenario:

```bash
docker-compose run --rm k6 run /k6/scenarios/ramp-up.js
```

**What to Observe:**

* Response times as load increases
* Any rate-limiting or throttling issues
* Error spikes during peak traffic

---

## Scenario 2: Burst Traffic / Spikes

**Purpose:** Simulate sudden bursts of requests to test system resilience.

**Steps:**

1. Create a scenario (`k6/scenarios/custom-burst.js`):

```js
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Warm up
    { duration: '30s', target: 200 }, // Sudden burst!
    { duration: '3m', target: 50 },   // Stabilize
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

export default function () {
  // Test toy-api endpoints
  const endpoints = ['/fast', '/users', '/jobs'];
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  http.get(`${__ENV.TARGET_API_URL}${endpoint}`);
  sleep(Math.random() * 2);
}
```

2. Run:

```bash
docker-compose run --rm k6 run /k6/scenarios/custom-burst.js
```

**What to Observe in Grafana:**

* Open the **k6-elite** dashboard for detailed percentile analysis
* System stability during the burst (p95/p99 latency spikes)
* Error rates during burst periods
* Recovery behavior after the spike

**Toy API behaviors to test:**

* `/fast` - Quick responses, good baseline
* `/slow` - Simulates slow queries, shows resource contention
* `/cpu` - CPU-intensive, reveals compute limits
* `/error` - Random errors for failure handling

---

## Scenario 3: Randomized Arrival / Think Time

**Purpose:** Simulate more realistic user behavior with variable request timing.

**Steps:**

```js
import http from 'k6/http';
import { sleep } from 'k6';

export let options = {
  vus: 50,
  duration: '15m',
};

export default function () {
  http.get(`${__ENV.TARGET_API_URL}/`);
  sleep(Math.random() * 5);  // Randomized think time
}
```

**Notes:**

* Useful for modeling “real” user behavior
* Helps find latency issues and queue bottlenecks
* Combine with bursts or ramp-ups for complex scenarios

---

## Scenario 4: Mixed Endpoints / Multi-Step Workflow

**Purpose:** Test APIs with multiple endpoints in a single user session.

**Steps:**

1. Example scenario (`k6/scenarios/multi-step.js`):

```js
import http from 'k6/http';
import { sleep } from 'k6';

export let options = {
  stages: [
    { duration: '10m', target: 20 },
    { duration: '10m', target: 50 },
    { duration: '5m', target: 0 },
  ],
};

export default function () {
  const res1 = http.get(`${__ENV.TARGET_API_URL}/endpoint1`);
  sleep(1 + Math.random() * 2);

  const res2 = http.post(`${__ENV.TARGET_API_URL}/endpoint2`, { key: 'value' });
  sleep(1 + Math.random() * 2);

  http.get(`${__ENV.TARGET_API_URL}/endpoint3`);
}
```

**What to Observe:**

* How multi-step workflows behave under load
* Dependency-related latency
* End-to-end throughput and failure points

---

## Scenario 5: High Concurrency / Stress Test

**Purpose:** Test the limits of your API and identify breaking points.

**Steps:**

1. Configure `.env` for high concurrency:

```env
CONCURRENCY=500
DURATION=10m
```

2. Run a simple k6 scenario targeting the main endpoint:

```js
import http from 'k6/http';

export let options = {
  vus: 500,
  duration: '10m',
};

export default function () {
  http.get(`${__ENV.TARGET_API_URL}/`);
}
```

**What to Observe:**

* Maximum sustainable throughput
* Error and failure patterns under stress
* Latency trends at high load

---

## Key Takeaways

* The lab allows **simulating many types of traffic patterns** without affecting production.
* By combining **stages, think times, bursts, and multi-step workflows**, you can mimic realistic scenarios.
* **Metrics and dashboards** give visibility into latency, errors, and throughput.
* The toy-api's 8 endpoints (`/fast`, `/slow`, `/cpu`, `/io`, `/error`, `/jobs`, `/users`, `/health`) provide diverse testing targets.

---

## Congratulations! 🎉

You've now completed the **Basic Series** and can:
- ✅ Understand why load testing matters ([Article 1](art1.md))
- ✅ Set up and run the lab ([Article 2](art2.md))
- ✅ Execute common testing scenarios (this article)
- ✅ Interpret results in Grafana

---

## What's Next?

Ready to level up? The **Advanced Series** takes you deeper:

### **Immediate Next Steps:**
1. **[Advanced Art1: Extended Introduction](../advanced/art1.md)** - Deeper context on load testing philosophy
2. **[Advanced Art4: Metrics Deep Dive](../advanced/art4.md)** - Master percentiles, throughput, error rates, and create alerts
3. **[Advanced Art5: CI/CD Integration](../advanced/art5.md)** - Automate tests in GitHub Actions/GitLab CI

### **Advanced Topics:**
- **[Mock APIs & Workers](../advanced/art6.md)** - Deep dive into toy-api architecture and async job testing
- **[Chaos Testing](../advanced/art7.md)** - Network delays, failure injection, extreme scenarios
- **[Performance Optimization](../advanced/art8.md)** - Turn metrics into actionable improvements
- **[Cross-Ecosystem Strategies](../advanced/art9.md)** - Apply principles to Sentry, Datadog, cloud platforms

### **Complete Roadmap:**
- **[Series Overview](../advanced/art0.md)** - See all 10+ articles with reading times and objectives

---

**[Continue to Advanced Series →](../advanced/art1.md)** | **[Jump to Metrics Deep Dive →](../advanced/art4.md)**
* Every team can **adapt scenarios** to their own APIs without additional infrastructure setup.

---

## Conclusion

With these 5 general scenarios, you now have a **starting toolkit** for testing APIs and services in a **controlled, reproducible environment**.

The key is to **experiment**, observe results, and adjust concurrency, duration, and arrival patterns based on your system’s capabilities.

The **Load Testing Lab** makes it easy to run these experiments consistently, and visualize performance in Grafana with minimal setup.
