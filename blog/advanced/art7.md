
# **Load Testing Lab – Advanced Traffic Patterns and Chaos Testing**

**Part of:** [Load Testing Lab Series](art0.md) | **Previous:** [← Mock APIs](art6.md) | **Next:** [Performance Optimization →](art8.md)

**Estimated reading time:** 10–12 minutes

---

> 💡 **Series Context:** This article builds on [Article 6's mock APIs](art6.md) and assumes you're comfortable with k6 scenarios (covered in [Articles 2-3](art2.md)). We're now exploring **extreme testing conditions** and **chaos engineering principles**.

In the [previous article](art6.md), we explored **mock APIs and synthetic data**, giving you a fully isolated environment to generate realistic load without touching production. With that foundation, it's time to **push your APIs further**: testing how they behave under **unexpected conditions, network anomalies, and potential chaos**.

This article will guide you through creating **advanced traffic patterns**, introducing **chaos testing techniques**, and helping you understand how your services respond under extreme stress. The goal is **not to break your production system**, but to safely explore its resilience within the **Load Testing Lab**.

---

## **Understanding Advanced Traffic Patterns**

Real-world traffic rarely behaves in a predictable, uniform manner. While ramp-ups, spikes, and variable arrivals cover the majority of load-testing needs, there are scenarios where traffic can be **irregular, intermittent, or even “malicious”**:

* Sudden bursts followed by idle periods
* Slow clients causing resource contention
* Clients sending malformed or extreme payloads

To simulate this, **Load Testing Lab** allows you to define **custom scenarios** in k6 or Artillery that include variable rates, timeouts, and error injections.

For example, in k6 you might simulate users arriving in **random bursts**, with some requests intentionally delayed to mimic network latency:

```js
import http from 'k6/http';
import { sleep } from 'k6';

export let options = {
  scenarios: {
    burst_traffic: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { target: 50, duration: '2m' },   // ramp up to burst
        { target: 50, duration: '3m' },   // sustain burst
        { target: 5, duration: '2m' },    // ramp down
      ],
    },
    slow_clients: {
      executor: 'constant-arrival-rate',
      rate: 10,
      duration: '7m',
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
  },
};

export default function () {
  // simulate network variability
  const start = Date.now();
  const res = http.get(`${__ENV.TARGET_API_URL}/endpoint`);
  const latency = Date.now() - start;
  if (latency > 2000) {
    console.warn(`High simulated network latency: ${latency}ms`);
  }
  sleep(Math.random() * 3);
}
```

This scenario not only simulates **bursty traffic**, but also introduces **latency variance**, helping you understand how your service handles uneven load and delayed responses.

---

## **Simulating Failures and Network Anomalies**

Chaos testing involves **injecting faults** into your system to see how it reacts. Within **Load Testing Lab**, you can safely simulate:

* **Intermittent failures:** occasional HTTP 500 responses
* **Timeouts:** simulate slow services or network delays
* **Dropped requests:** random request loss to mimic packet loss

A simple approach is to implement **fault injection in mock APIs**:

```js
app.get('/unstable', (req, res) => {
  const rand = Math.random();
  if (rand < 0.2) {
    res.status(500).send({ error: 'Simulated server error' });
  } else if (rand < 0.4) {
    setTimeout(() => res.json({ status: 'delayed response' }), 3000); // 3s delay
  } else {
    res.json({ status: 'ok' });
  }
});
```

During load tests, your metrics dashboards will capture **latency spikes, error rates, and retry behavior**, giving you actionable insights into system robustness.

---

## **Introducing Chaos Tools**

While simple fault injection works, there are **dedicated chaos testing frameworks** you can optionally integrate:

* **Gremlin** or **Chaos Monkey**: controlled chaos for microservices
* **k6 + custom scripts**: inject delays, abort requests, or vary load patterns
* **Docker Compose overrides**: simulate container failures or service restarts

For instance, you could temporarily **stop a container mid-test** to see how your API recovers from a dependent service outage:

```bash
docker-compose stop mock-server
# wait a few seconds, then bring it back
docker-compose start mock-server
```

Combined with k6 scenarios and Grafana metrics, you’ll have **full visibility of system behavior under failure conditions**, all in a controlled, repeatable environment.

---

## **Practical Insights**

Testing under chaos and advanced traffic patterns often reveals issues you wouldn’t encounter with simple ramp-ups:

* Unexpected **queue backlogs** when async jobs accumulate
* Resource saturation when multiple slow clients occupy connections
* Failure handling gaps in retries or error logging
* Latency spikes during network anomalies

By using **Load Testing Lab**, you can **simulate these conditions repeatedly**, ensuring your service is resilient before any real-world incident occurs.

---

## **Best Practices**

1. **Start small**: Begin chaos experiments with low concurrency and limited faults.
2. **Always isolate the environment**: Never perform destructive tests on production.
3. **Capture metrics continuously**: Latency, throughput, error rate, and worker queue depth are essential.
4. **Combine with monitoring**: Grafana dashboards give visual cues for stress points.
5. **Document scenarios**: Each advanced test should be repeatable and versioned in your lab repository.

---

## **Conclusion**

With **advanced traffic patterns and chaos testing**, Load Testing Lab allows you to **evaluate the resilience of your APIs under extreme conditions**. By simulating network issues, intermittent failures, and unexpected workloads, you can uncover bottlenecks and vulnerabilities before they affect real users.

This final step elevates your load-testing strategy from basic stress tests to **robust, production-like resilience testing**, giving you confidence that your services can handle real-world uncertainty—**all within a safe, fully containerized environment**.
