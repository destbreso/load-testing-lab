# Article 2: Getting Started with Your Load Testing Lab – Step by Step

**Part of:** [Load Testing Lab Series](../advanced/art0.md) | **Previous:** [← Introduction](art1.md) | **Next:** [Common Scenarios →](art3.md)

**Estimated reading time:** 7–10 minutes

---

## Introduction

In [the first article](art1.md), we introduced the challenge: building a reusable, self-contained environment to test APIs and complex workflows without touching production systems. Now, it's time to **get hands-on**. In this tutorial, I'll walk you through how to **set up the lab, run your first test, and visualize results**—all without worrying about complex infrastructure.

> ⚠️ **Disclaimer:** This is my personal solution designed to be practical and reusable. It's not the only way to do load testing, and it won't cover every scenario. Each team can adapt it to their own needs.
>
> 💡 **Series Context:** This is a hands-on quickstart. For deeper configuration options, see [Article 2 Advanced](../advanced/art2.md). For the complete series, check the [Overview](../advanced/art0.md).

---

## 1. Clone the Repository and Prepare Your Environment

Start by cloning the project:

```bash
git clone https://github.com/destbreso/load-testing-lab.git
cd load-testing-lab
```

Make sure you have the prerequisites installed:

* **Docker ≥ 24.0**
* **Docker Compose ≥ 2.18**
* **Node.js ≥ 18** (optional, for local scripts)
* Optional: k6 or Artillery CLI if you want to run tests outside Docker

Copy the example environment file and adjust settings if needed:

```bash
## 1. Configuration

**The lab works with sensible defaults** - you can start without any `.env` file! However, to customize behavior, you can create a `.env` file:

```bash
cp .env.example .env  # If .env.example exists
# Or create .env manually
```

Basic configuration:

```env
# Target API - defaults to included toy-api service
TARGET_API_URL=http://toy-api:5000

# k6 test parameters
CONCURRENCY=50
DURATION=30s

# Grafana access (defaults work fine)
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin123
```

**Important notes:**

* All configuration has defaults in `docker-compose.yml`
* Use `http://toy-api:5000` to test the included mock API (8 endpoints)
* To test external APIs, see the main README's "Testing External APIs" section

---

## 2. Start the Lab Stack

Bring up all services with Docker Compose:

```bash
docker-compose up -d
```

Check that all services are running:

```bash
docker-compose ps
```

At this point, you should have:

* **influxdb** - Metrics storage (InfluxDB v2.6)
* **grafana** - Dashboards (6 pre-configured dashboards)
* **telegraf** - Metrics bridge for Artillery
* **toy-api** - Sample API with 8 endpoints

The `k6` service runs on-demand (not persistent).
* **InfluxDB** storing metrics
* **Grafana** for visualizing results

Open Grafana in your browser: [http://localhost:3000](http://localhost:3000)
*User:* `admin`
*Password:* `admin123`

---

## 3. Reset Metrics (Optional)

If you want to start fresh with empty metrics:

```bash
./scripts/reset-metrics.sh
```

This clears InfluxDB data and ensures dashboards reflect only the new test.

---

## 4. Run a Sample Load Test

### Using the CLI (Recommended)

The lab includes a professional CLI. Install it globally:

```bash
npm link
```

Run a prebuilt k6 scenario:

```bash
ltlab k6 -s toy-fast.js
```

Run an Artillery scenario:

```bash
ltlab artillery -s basic.yml
```

### Using Docker Compose (Alternative)

```bash
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js
docker-compose run --rm artillery run /artillery/scenarios/basic.yml
```

Metrics flow automatically to InfluxDB for visualization.

---

## 5. Observe Metrics in Grafana

Once your test is running, navigate to Grafana:

* View **response times** (p50, p95, p99)
* Track **throughput** (requests/sec)
* Monitor **error rates**
* Inspect virtual user concurrency

The dashboards are prebuilt and included in `grafana/dashboards`, ready to display your lab’s test data.

---

## 6. Stop the Lab

When done, shut down all containers cleanly:

```bash
ltlab stop
# Or: docker-compose down
```

This stops all services and cleans up resources.

---

## Congratulations! 🎉

You've successfully:
- ✅ Set up the Load Testing Lab
- ✅ Started all services (InfluxDB, Grafana, Telegraf, Toy-API)
- ✅ Ran your first k6 test
- ✅ Viewed metrics in Grafana dashboards

---

## What's Next?

Now that you have the lab running, it's time to explore **realistic testing scenarios**.

**In the next article ([Common Scenarios](art3.md))**, you'll learn:
- How to simulate gradual ramp-ups
- Testing traffic spikes and bursts
- Creating multi-endpoint test flows
- Interpreting results in Grafana

**Want to go deeper?**
- [Metrics Deep Dive](../advanced/art4.md) - Master p50/p95/p99 latencies and create alerts
- [Mock APIs Guide](../advanced/art6.md) - Learn about the toy-api endpoints and async workers
- [CI/CD Integration](../advanced/art5.md) - Automate these tests in GitHub Actions
- [Full Series](../advanced/art0.md) - See all 10+ articles

---

**[Continue to Article 3: Common Scenarios →](art3.md)**

---

## 7. Customize for Your APIs

You can now adapt the lab to any API:

* Update `.env` with a new `TARGET_API_URL`
* Add new k6 or Artillery scenarios in `k6/scenarios/` or `artillery/scenarios/`
* Modify concurrency and duration settings in `.env` or within scenario files
* Extend dashboards in Grafana to visualize new metrics

### Using Your Own Test Files (External Projects)

You don't need to copy files into the lab! The CLI auto-detects local files:

```bash
# From your project directory
cd ~/projects/my-api

# Run your local test file
ltlab k6 -s ./tests/stress-test.js

# For scenarios with imports, use project mode
ltlab k6 -p ./tests -s main.js

# Add custom dashboards
ltlab dashboard link ./tests/dashboards
ltlab restart -s grafana
```

**📚 Full guide:** [External Projects Guide](../../docs/EXTERNAL_PROJECTS.md)

---

## 8. Key Takeaways

* **Reusable & portable:** The lab works across projects with minimal setup.
* **Visual insights:** Metrics are automatically collected and visualized.
* **Step-by-step:** Quickstart lets anyone run realistic API tests in minutes.
* **Extensible:** Add more scenarios, APIs, or metrics as needed.

By following these steps, you can quickly have a **full load testing lab running locally** and start evaluating your API’s behavior under realistic workloads.

