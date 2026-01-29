
# **Load Testing Lab – Common API Testing Scenarios**

In the first article, we introduced **Load Testing Lab** and its purpose: providing a reusable, containerized environment for load testing APIs. In the second, we walked through **setting up the lab and running your first tests**.

Now, it’s time to explore **realistic scenarios**. In this tutorial, we’ll walk through **five common API testing situations**, showing how to simulate them, what to measure, and how to interpret results. This will give you practical guidance for stress-testing any service in development or staging environments.

---

## **1. Steady Load Test**

**Scenario:** You want to simulate a consistent number of users over a fixed period. This is the baseline to measure your system under normal expected traffic.

**Implementation with k6:**

```js
import http from 'k6/http';
import { sleep } from 'k6';

export let options = {
  vus: 50,          // 50 concurrent users
  duration: '10m',  // run for 10 minutes
};

export default function () {
  // Test the /fast endpoint (returns quickly)
  http.get(`${__ENV.TARGET_API_URL}/fast`);
  sleep(1);          // simulate user think-time
}
```

**Running the scenario:**

```bash
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js
```

**Why it matters:**
This test shows how your API handles a predictable, continuous load. Use Grafana to observe latency trends and error rates.

**Tips:**

* Ensure the target environment is isolated.
* Monitor CPU, memory, and database performance alongside request metrics.

---

## **2. Spike / Burst Traffic**

**Scenario:** Traffic suddenly spikes due to an event, like a marketing campaign or a flash sale.

**Implementation with k6 stages:**

```js
export let options = {
  stages: [
    { duration: '1m', target: 10 },  // ramp-up
    { duration: '2m', target: 200 }, // sudden spike
    { duration: '5m', target: 50 },  // gradual ramp-down
  ],
};

export default function () {
  http.get(`${__ENV.TARGET_API_URL}/endpoint`);
  sleep(Math.random() * 2);
}
```

**Key metrics to watch:**

* Maximum latency during the spike
* Error rate  
* Resource saturation (CPU, memory, DB connections)

**Visualizing in Grafana:**

Open http://localhost:3000 and navigate to:

* **k6-dashboard** - Basic metrics overview
* **k6-elite** or **k6-pro** - Advanced percentile analysis

You'll see latency spikes clearly marked in the p95/p99 graphs.

**Practical tip:**
This type of test uncovers throttling issues and rate-limiting configurations. The toy-api included in the lab can simulate various response times - test `/slow` to see how the system handles mixed performance.

---

## **3. Ramp-Up / Ramp-Down Test**

**Scenario:** Gradually increase traffic to find your system’s **breaking point**, then decrease it to observe recovery.

**Implementation example:**

```js
export let options = {
  stages: [
    { duration: '5m', target: 50 },  // ramp-up
    { duration: '10m', target: 100 }, // peak load
    { duration: '5m', target: 0 },    // ramp-down
  ],
};

export default function () {
  http.get(`${__ENV.TARGET_API_URL}/endpoint`);
  sleep(1);
}
```

**Why it matters:**

* Identifies performance bottlenecks gradually.
* Tests how well services recover after peak load.

**Visualization:**
Grafana graphs will show response time trends and throughput throughout the ramp phases.

---

## **4. Long-Running / Endurance Test**

**Scenario:** Ensure your system handles **sustained traffic over hours or days** without memory leaks, database connection exhaustion, or degradation.

**Implementation snippet:**

```js
export let options = {
  vus: 20,           // moderate load
  duration: '12h',   // long test
};

export default function () {
  http.get(`${__ENV.TARGET_API_URL}/endpoint`);
  sleep(1);
}
```

**Best practices:**

* Use a **dedicated environment**, never production for endurance tests.
* Monitor memory, CPU, DB connections, and network bandwidth.
* Store metrics in InfluxDB for later analysis.

**Outcome:**
Spot long-term issues such as connection leaks, slow queries, or gradual degradation.

---

## **5. Variable Traffic / Realistic Arrival Patterns**

**Scenario:** Users arrive unpredictably, sometimes in bursts, sometimes slowly. This mimics real-world patterns.

**k6 example using Poisson arrivals:**

```js
import http from 'k6/http';
import { sleep } from 'k6';

export let options = {
  scenarios: {
    random_arrival: {
      executor: 'constant-arrival-rate',
      rate: 20,           // 20 iterations per second
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
};

export default function () {
  http.get(`${__ENV.TARGET_API_URL}/endpoint`);
  sleep(Math.random() * 2);
}
```

**Why it’s useful:**

* Tests your API against **unpredictable real-world traffic**.
* Identifies **queue saturation** or **worker bottlenecks**.
* Useful for APIs that handle asynchronous tasks or message queues.

---

## **Tips for All Scenarios**

1. **Start small:** Always test with low concurrency before scaling up.
2. **Use metrics:** Grafana + InfluxDB dashboards give insights into latency percentiles, error rates, and throughput.
3. **Document your scripts:** Each scenario should have its own script and configuration.
4. **Reset metrics between tests:** Ensures data clarity.
5. **Combine scenarios:** You can run ramp-up followed by spike traffic to simulate real-world events.

---

## **Conclusion**

With these five scenarios, you can:

* Test baseline performance
* Identify system limits
* Simulate realistic user behavior
* Analyze async and queue-based workloads

The **Load Testing Lab** provides the infrastructure—Dockerized, reusable, and instrumented—so you can focus on **building reliable APIs** without worrying about setting up the environment every time.

By applying these scenarios to your projects, you’ll gain confidence in system performance under real-world conditions, catch bottlenecks early, and improve the overall resilience of your services.

