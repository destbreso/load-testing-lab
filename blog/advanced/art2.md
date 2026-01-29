# **Load Testing Lab – Step-by-Step Quickstart for API Testing**

**Part of:** [Load Testing Lab Series](art0.md) | **Previous:** [← Introduction](art1.md) | **Next:** [Realistic Scenarios →](art3.md)

**Estimated reading time:** 7–10 minutes

---

> 💡 **About this article:** This is an extended quickstart guide building on the [basic setup](../basic/art2.md). If you're completely new, start with the [Basic Series](../basic/art1.md) first. This article provides deeper configuration details and advanced usage patterns.

In the [previous article](art1.md), we introduced **Load Testing Lab**, explained why it exists, and how it can help developers simulate realistic API workloads. Now, it's time to get **hands-on**.

In this tutorial, we’ll walk through setting up the lab, running your first load tests, and visualizing the results in Grafana. By the end, you’ll have a fully operational environment ready to test **any API** without touching production.

---

## **1. Getting the Lab**

Clone or download the **Load Testing Lab** repository:

```bash
git clone https://github.com/destbreso/load-testing-lab.git
cd load-testing-lab
```

The lab includes:

* **k6/** - Load testing scenarios with xk6-influxdb extension pre-compiled
* **artillery/** - Alternative load testing scenarios
* **grafana/** - Pre-configured dashboards (6 dashboards ready to use)
* **toy-api/** - Sample API with 8 endpoints for testing
* **telegraf/** - Metrics bridge for Artillery → InfluxDB
* **docker-compose.yml** - Complete stack orchestration

---

## **2. Configuration**

**The lab works out-of-the-box** with defaults defined in `docker-compose.yml`. However, you can customize behavior by creating a `.env` file:

```env
# API Target - Use the toy-api service or external endpoint
TARGET_API_URL=http://toy-api:5000

# InfluxDB (all have defaults, override if needed)
INFLUXDB_USER=admin
INFLUXDB_PASSWORD=admin123
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=loadtests
INFLUXDB_PORT_EXPORT=8086

# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin123
GRAFANA_PORT=3000

# k6 Test Parameters
CONCURRENCY=50
DURATION=30s
```

**Understanding the Configuration:**

* **No .env required**: Docker Compose uses defaults (see the `:-` syntax in docker-compose.yml)
* **TARGET_API_URL**: Points to `toy-api` service by default (included mock API with 8 endpoints)
* **Testing External APIs**: For APIs outside Docker, see the main README section on host access patterns
* **CONCURRENCY/DURATION**: Used by k6 scenarios via `__ENV` variables

---

## **3. Starting the Lab**

All components run in Docker containers. Start them with:

```bash
docker-compose up -d
```

This will start:

* **influxdb** - Metrics database (InfluxDB v2.6)
* **grafana** - Visualization (6 pre-configured dashboards)
* **telegraf** - Metrics bridge for Artillery (StatsD → InfluxDB)
* **toy-api** - Sample API with 8 endpoints (/fast, /slow, /cpu, /io, /error, /jobs, /users, /health)

Verify all services are running:

```bash
docker-compose ps
```

You should see:
```
NAME        IMAGE                    STATUS
grafana     grafana/grafana:10.1.0   Up
influxdb    influxdb:2.6             Up
telegraf    telegraf:1.28-alpine     Up
toy-api     <built locally>          Up
```

**Note**: `k6` is not a persistent service - it runs on-demand for tests.

---

## **4. Running Your First Test**

The lab includes several pre-configured scenarios. Let's run a simple one:

```bash
# Run the toy-fast scenario (50 VUs for 30 seconds)
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js
```

You'll see k6 output with real-time metrics:

```
     ✓ http_req_duration..............: avg=45ms  min=12ms med=38ms max=156ms p(95)=98ms  p(99)=142ms
     ✓ http_req_failed................: 0.00%  ✓ 0    ✗ 15000
     http_reqs......................: 15000  500/s
```

**Available k6 scenarios:**

* `toy-fast.js` - Tests `/fast` endpoint (50 VUs, 30s)
* `toy-stress.js` - Stress test with high concurrency
* `toy-mixed.js` - Mixed endpoints testing
* `toy-workers.js` - Tests async job processing
* `inspection-flow.js` - Multi-step user flow simulation
* `chaos-basic.js` - Mixed chaos engineering (errors, latency, CPU)
* `chaos-spike.js` - Traffic spike with failures
* `chaos-resilience.js` - Retry logic and recovery patterns

**Testing with Artillery:**

```bash
docker-compose run --rm artillery run /artillery/scenarios/toy-fast.yml
```

## **5. Access Grafana**

Grafana provides real-time dashboards for your tests. Open your browser:

[http://localhost:3000](http://localhost:3000)

Login:

* **User:** admin
* **Password:** admin123

You’ll see pre-configured dashboards for metrics such as response time percentiles, throughput, and errors.

---

## **5. Reset Metrics (Optional)**

If you’ve run previous tests and want a clean slate:

```bash
./scripts/reset-metrics.sh
```

This will clear InfluxDB data so your next test results are isolated.

---

## **6. Running a k6 Test**

k6 scripts are in `k6/scenarios/`. Let’s run a simple scenario:

```bash
docker-compose run --rm k6 run /k6/scenarios/inspection-flow.js
```

The script simulates concurrent requests to your target API. As it runs, metrics are automatically pushed to InfluxDB.

**Tip:** You can change concurrency and duration without editing the script, just override `.env` values:

```env
CONCURRENCY=100
DURATION=120s
```

---

## **7. Running an Artillery Test**

Artillery is an alternative tool if you prefer YAML-defined scenarios:

```bash
docker-compose run --rm artillery run /artillery/scenarios/inspection-flow.yml
```

It supports complex workflows, payload variations, and ramp-up stages. Results are also pushed to InfluxDB.

---

## **8. Observing Metrics in Grafana**

Once your test is running, Grafana dashboards update in real time. Key metrics to watch:

* **Throughput**: Requests per second
* **Latency**: p50, p95, p99 percentiles
* **Error rate**: Percentage of failed requests
* **Concurrent virtual users**: See load over time
* **Optional async worker latency**: If using mocks or worker simulations

These dashboards help you spot bottlenecks and validate if your system meets expectations under load.

---

## **9. Stopping the Lab**

When done testing:

```bash
docker-compose down
```

This stops all containers and frees up resources.

---

## **10. Switching Between Projects**

One of the lab’s strengths is **reusability**. To test another API:

1. Update `TARGET_API_URL` in `.env`
2. Add or modify k6/Artillery scenario scripts
3. Reset metrics if necessary
4. Run the test again

You don’t need to rebuild containers—your lab stack is ready for any project.

---

## **11. Best Practices for Your Tests**

* Start with small concurrency and short duration, then gradually increase.
* Always test in an **isolated environment**.
* Use dashboards to observe trends rather than raw logs.
* Make copies of `.env` for each project to keep configurations separate.
* Document your test scripts and scenarios for team use.

---

### **Conclusion**

With **Load Testing Lab**, you now have a ready-to-use, containerized setup for API load testing. Whether you’re exploring performance, stress-testing an endpoint, or validating async workflows, this lab gives you everything in one place: **load generators, metrics storage, and visualization**.

In the next article, we’ll go a step further: **common scenarios and how to simulate them**. We’ll look at 4-5 realistic testing situations, from bursts of traffic to long-running async queues, showing how you can tweak your lab to match real-world conditions.
