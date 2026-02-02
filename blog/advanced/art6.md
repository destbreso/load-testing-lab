
# **Load Testing Lab – Mock APIs and Synthetic Data**

**Part of:** [Load Testing Lab Series](art0.md) | **Previous:** [← CI/CD Integration](art5.md) | **Next:** [Chaos Testing →](art7.md)

**Estimated reading time:** 7–10 minutes

---

> 💡 **Series Context:** This article explores the **toy-api** mentioned throughout the series. If you've been following along, you've already used endpoints like `/fast` and `/slow`. Now we'll dive deep into how they work and how to extend them.

In the [previous article](art5.md), we explored integrating **Load Testing Lab** into CI/CD pipelines, allowing automated performance testing and historical metrics tracking.

Now, we turn our attention to a critical aspect of realistic testing: **simulating external dependencies without touching production systems**. This involves creating **mock APIs, synthetic data, and fake background services**—all fully controllable within your lab.

By the end of this article, you’ll be able to **run complex test scenarios entirely within an isolated environment**, ensuring reproducible and safe load tests.

---

## **Why Mocking and Synthetic Data Matters**

APIs rarely exist in isolation. Most services depend on:

* External APIs (payment gateways, third-party services)
* Databases with varying datasets
* Background workers or message queues

Testing against real dependencies is risky: production data can be corrupted, rate limits may trigger, and test results may become non-reproducible.

**Load Testing Lab includes a complete mock API** called `toy-api` with 8 pre-configured endpoints:

* `/fast` - Quick responses (~10ms)
* `/slow` - Variable latency (500-2500ms)
* `/cpu` - CPU-intensive operations
* `/io` - I/O operations (300-1500ms)
* `/error` - Random errors (30% failure rate)
* `/jobs` - Async job creation
* `/users` - Returns 50 mock users
* `/health` - Health check endpoint

Additionally, the toy-api includes a **fake background worker** that processes jobs asynchronously, letting you test queue behavior and worker latency.

This ensures **safe, repeatable, and realistic load tests** without external dependencies.

---

## **1. Using the Included Toy API**

**Load Testing Lab ships with a ready-to-use mock API** called `toy-api`. It's a Node.js/Express service already integrated in `docker-compose.yml`.

**Exploring the toy-api:**

The toy-api provides diverse endpoints to test different scenarios:

```javascript
// Available endpoints in toy-api/src/index.js
app.use("/health", health);   // Health check
app.use("/fast", fast);       // Fast responses (~10ms)
app.use("/slow", slow);       // Variable latency (500-2500ms)
app.use("/error", error);     // Random errors (30% failure rate)
app.use("/cpu", cpu);         // CPU-bound operations
app.use("/io", io);           // I/O operations (300-1500ms)
app.use("/users", users);     // Returns 50 mock users
app.use("/jobs", jobs);       // Async job creation
```

**Testing different behaviors:**

```bash
# Test fast responses
curl http://localhost:5000/fast

# Test slow queries
curl http://localhost:5000/slow

# Create a job (simulates async processing)
curl -X POST http://localhost:5000/jobs \
  -H "Content-Type: application/json" \
  -d '{"task": "process_data"}'
```

**Key advantages:**

* **Already configured** - No setup needed, runs with `docker-compose up`
* **Realistic behaviors** - Simulates fast/slow/error responses
* **Background worker** - Includes a fake worker for queue testing
* **Synthetic data** - Generates random users, jobs, and responses

## **2. Creating Custom Mock Endpoints**

If you need additional endpoints, you can extend the toy-api or create a separate mock service:

```javascript
// In toy-api/src/routes/custom.js
import express from 'express';
import { randomUUID } from 'crypto';

const router = express.Router();

// Custom endpoint for your testing needs
router.get('/orders', (req, res) => {
  const count = parseInt(req.query.count || '10', 10);
  const orders = Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    orderNumber: `ORD-${1000 + i}`,
    amount: (Math.random() * 500).toFixed(2),
    status: ['pending', 'completed', 'failed'][Math.floor(Math.random() * 3)]
  }));
  res.json(orders);
});

export default router;
```

Then add it to `toy-api/src/index.js`:

```javascript
import custom from './routes/custom.js';
app.use('/orders', custom);
```

Restart the services:

```bash
docker-compose restart toy-api
```

## **3. Testing Async Workers and Queues**

The toy-api includes a **fake background worker** that processes jobs asynchronously. This simulates real-world queue systems like RabbitMQ, Redis Queue, or AWS SQS.

**How it works:**

1. POST to `/jobs` creates a job
2. The fake worker picks it up (simulated delay)
3. Job status transitions: pending → processing → completed

**Testing job processing under load:**

```javascript
// k6 scenario for testing async jobs
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '2m',
};

export default function () {
  // Create a job
  const createRes = http.post(
    `${__ENV.TARGET_API_URL}/jobs`,
    JSON.stringify({ task: 'process_data', priority: 'high' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(createRes, {
    'job created': (r) => r.status === 201,
    'has job ID': (r) => JSON.parse(r.body).jobId !== undefined,
  });

  const jobId = JSON.parse(createRes.body).jobId;
  
  // Poll job status
  const statusRes = http.get(`${__ENV.TARGET_API_URL}/jobs/${jobId}`);
  
  check(statusRes, {
    'job status retrieved': (r) => r.status === 200,
  });
  
  sleep(1);
}
```

**Run the worker test:**

```bash
docker-compose run --rm k6 run /k6/scenarios/toy-workers.js
```

**Metrics to observe in Grafana:**

* Job creation rate (requests to `/jobs`)
* Job status check latency
* Error rate (failed job creations)
* System behavior under queue pressure

This pattern translates directly to testing real queue systems - replace the toy-api with your actual worker API and apply the same load patterns.

---

## **2. Generating Synthetic Data for Load**

Load tests are more meaningful when you simulate **realistic datasets**.

For example, with k6:

```js
import http from 'k6/http';
import { sleep } from 'k6';

export let options = {
  vus: 30,
  duration: '5m',
};

export default function () {
  const payload = {
    userId: Math.floor(Math.random() * 10000),
    orderAmount: (Math.random() * 200).toFixed(2),
    productId: `prod-${Math.floor(Math.random() * 500)}`,
  };

  http.post(`${__ENV.TARGET_API_URL}/orders`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  sleep(Math.random() * 2);
}
```

**Why it’s useful:**

* Simulates diverse requests across multiple users and datasets.
* Can uncover issues like data validation errors, race conditions, or unexpected payload edge cases.

**Tip:** For repeatable tests, seed your random generator or log generated data.

---

## **3. Simulating Queues and Workers**

Many systems rely on background processing. Instead of connecting to production queues, you can **simulate workers inside the lab**:

```js
// simple in-memory worker
import { EventEmitter } from 'events';
const workerBus = new EventEmitter();

workerBus.on('job', (data) => {
  console.log('Processing job:', data);
  // simulate processing delay
  setTimeout(() => {
    console.log('Job complete:', data.id);
  }, Math.random() * 1000);
});

// enqueue jobs from mock API or k6 scenario
workerBus.emit('job', { id: 'job-1', payload: {} });
workerBus.emit('job', { id: 'job-2', payload: {} });
```

**Integration notes:**

* Combine with **mock endpoints**: POST to `/process` triggers an in-memory job.
* Track **queue depth and processing latency** in metrics (InfluxDB).
* Enables testing **async workloads** without touching external services.

---

## **4. Combining Mocks, Synthetic Data, and Load Testing**

By combining the above, you can create **full-stack simulations**:

1. k6 or Artillery generates synthetic traffic.
2. Mock APIs respond with controlled payloads.
3. In-memory workers process jobs asynchronously.
4. Metrics are collected in InfluxDB, visualized in Grafana.

This allows **end-to-end stress tests** entirely isolated from real production systems.

**Scenario example:**

* 50 virtual users POST orders to `/orders`
* Each request triggers a mock worker job
* Jobs complete with variable delays
* Grafana shows latency of requests, queue depth, and completion rate

All of this is **contained in your Load Testing Lab**, fully reproducible, and safe.

---

## **Best Practices for Mocking**

1. **Keep it lightweight:** Avoid heavy computation in mocks; CI runners have limited resources.
2. **Use realistic payloads:** Shape synthetic data like production (sizes, value ranges).
3. **Parameterize endpoints:** Accept query parameters to simulate variable behaviors.
4. **Combine with metrics:** Track synthetic job completion to detect bottlenecks.
5. **Reset state between runs:** Ensures consistency across multiple test executions.

---

## **Conclusion**

Mock APIs and synthetic data complete the picture for a **self-contained, reproducible load testing lab**. By simulating external dependencies and async workloads, you can:

* Run realistic load tests without touching production
* Generate diverse scenarios with controlled variability
* Measure system behavior under stress with full observability

Combined with prior articles in the series, this allows developers and QA engineers to confidently:

* Build robust, performance-tested APIs
* Avoid risky dependency calls during development or staging
* Keep testing workflows reproducible across projects

With this, your **Load Testing Lab** can truly mimic real-world systems entirely within a **safe, controlled, and reusable environment**.
