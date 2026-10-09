# Production Mode Guide

> **Using docker-compose.prod.yml for a lab that keeps running on its own**

---

## 📖 Overview

The Load Testing Lab provides two Docker Compose configurations:

- **`docker-compose.yml`** (Development) - The lab as `ltlab start` runs it
- **`docker-compose.prod.yml`** (Production) - The same stack, with `restart: unless-stopped` on InfluxDB, Grafana, Telegraf and the toy API, so they come back after a crash or a reboot of the host

Everything else is identical: the same services, health checks, ports, `.env` file and `influxdb-data` volume. Production mode does not add load generators: k6 and Artillery run one container per test, started on demand, in both files.

This guide covers when and how to use **Production Mode**.

---

## 🎯 When to Use Production Mode

### ✅ **Use Production Mode when:**

1. **The lab stays up on a shared machine**
   - A team server or a lab host that people use over days or weeks
   - Grafana and InfluxDB should come back by themselves after a crash or a reboot

2. **Running Long Duration Tests**
   - Soak tests (hours or days of sustained load)
   - Endurance tests to find memory leaks or gradual degradation
   - The services that store and show the metrics restart if they crash; the test itself does not restart (see [24-Hour Soak Test](#1-24-hour-soak-test))

### ❌ **Don't need Production Mode when:**

1. **Learning or Experimenting**
   - `ltlab start` and the other `ltlab` commands work with `docker-compose.yml`

2. **Quick Validation Tests**
   - A short run on a laptop gains nothing from restart policies

3. **A short-lived CI job**
   - The stack lives for one job, so restart policies make no difference; either file works

---

## 🚀 Getting Started

### Before the First Start

Production mode reads the same `.env` as the rest of the lab, and it needs `INFLUXDB_TOKEN` there. Create the file once with:

```bash
ltlab configure
```

It writes the lab's `.env` and generates the token. On its first start, InfluxDB adopts that token as its admin token, and Telegraf, Grafana and k6 read the same value. `ltlab start` refuses to run without it; `npm run start:prod` does not check, so create `.env` first.

### Start Production Mode

```bash
# Using npm script (recommended)
npm run start:prod

# Or directly
docker compose -f docker-compose.prod.yml up -d --wait
```

`--wait` returns when every service is running and InfluxDB, Grafana and the toy API pass their health checks.

**What starts:**
- InfluxDB, with a health check (`influx ping`) and auto-restart
- Grafana, with a health check (`/api/health`) and auto-restart
- Telegraf, with auto-restart
- Toy API, with a health check (`/health`) and auto-restart

k6 and Artillery are in the Compose profile `runners`: they never start with `up`, only for a run.

### Verify Services

```bash
docker compose -f docker-compose.prod.yml ps
```

InfluxDB, Grafana, Telegraf and the toy API are listed as running; InfluxDB, Grafana and the toy API also show `(healthy)`. Container names follow Compose's pattern, `<project>-<service>-1`, where the project is the lab's directory name.

### Run Tests

To make every `ltlab` command use the production file, add this line to the lab's `.env` (Docker Compose reads `COMPOSE_FILE` from it, and `ltlab configure` keeps the line when it runs again):

```bash
COMPOSE_FILE=docker-compose.prod.yml
```

Then `ltlab start`, `ltlab stop`, `ltlab restart`, `ltlab k6`, `ltlab artillery`, `ltlab chaos` and `ltlab run` all work on the production stack. Without that line, run tests with the production file explicitly:

```bash
# k6 (exits with 99 when a threshold fails)
docker compose -f docker-compose.prod.yml run --rm k6 run /k6/scenarios/toy-fast.js

# Artillery (exits with 1 when an ensure check fails)
docker compose -f docker-compose.prod.yml run --rm artillery run /artillery/scenarios/toy-fast.yml
```

The first run builds the k6 or Artillery image if this machine does not have it yet. To build both up front:

```bash
docker compose -f docker-compose.prod.yml build k6 artillery
```

### Stop Production Mode

```bash
# Using npm script
npm run stop:prod

# Or directly
docker compose -f docker-compose.prod.yml down
```

Metrics stay on the `influxdb-data` volume.

### Switching Between the Two Files

Both files belong to the same Compose project (named after the lab's directory) and use the same `influxdb-data` volume, so metrics carry over. Stop the running stack before starting the other one:

```bash
# Development to production
ltlab stop
npm run start:prod

# Production to development
npm run stop:prod
ltlab start
```

---

## 📈 Monitoring Production Mode

### Metrics in Grafana

Open Grafana: http://localhost:3000 (`GRAFANA_PORT`), with the user and password from `.env` (`GRAFANA_USER` and `GRAFANA_PASSWORD`, admin/admin123 by default).

Grafana keeps no state of its own: it has no volume, its dashboards and datasource come from provisioning files, and its admin user and password come from `.env` on every start. A dashboard changed only in the Grafana UI is lost when the stack goes down and up again; export its JSON model to its file to keep it (see [DASHBOARDS.md](DASHBOARDS.md#customizing-dashboards)).

### Service Logs

```bash
# One service (influxdb, grafana, telegraf or toy-api)
docker compose -f docker-compose.prod.yml logs influxdb

# Follow logs in real time
docker compose -f docker-compose.prod.yml logs -f telegraf
```

### Resource Monitoring

```bash
# Overall Docker stats
docker stats
```

---

## 🔥 Common Use Cases

### 1. 24-Hour Soak Test

**Goal:** Run sustained load for 24 hours to find memory leaks or gradual degradation.

```bash
# Start production mode (auto-restart enabled)
npm run start:prod

# Run a long-duration scenario of your own
docker compose -f docker-compose.prod.yml run --rm k6 run /k6/scenarios/<your-soak-scenario>.js

# Check the services periodically
docker compose -f docker-compose.prod.yml ps
```

If InfluxDB, Grafana, Telegraf or the toy API crashes, Docker restarts it. The test container has no restart policy: if it stops, or the host reboots, the test ends, and the metrics it wrote until then stay in InfluxDB.

The toy API keeps its memory bounded during long runs: finished jobs leave its in-memory store 10 minutes after they finish (`JOB_TTL_MS`, default 600000), so a soak test against the toy API shows flat memory.

### 2. CI/CD Pipeline Integration

**Example GitHub Actions workflow** (in a copy of the lab's repository):

```yaml
name: Performance Test

on:
  push:
    branches: [main]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start Load Testing Lab
        run: |
          # ltlab configure asks questions; in CI, write the lab's .env directly
          printf 'TARGET_API_URL=%s\nINFLUXDB_TOKEN=%s\n' "http://toy-api:5000" "$(openssl rand -hex 32)" > .env
          # Returns when every service is ready
          docker compose -f docker-compose.prod.yml up -d --wait

      - name: Run performance test
        # k6 exits with code 99 when a threshold fails, which fails the job
        run: docker compose -f docker-compose.prod.yml run --rm k6 run /k6/scenarios/toy-fast.js

      - name: Cleanup
        if: always()
        run: docker compose -f docker-compose.prod.yml down
```

To run tests from your own project's repository instead, see the CI example in [EXTERNAL_PROJECTS.md](EXTERNAL_PROJECTS.md#example-3-cicd-integration).

---

## ⚙️ Configuration Differences

### docker-compose.yml vs docker-compose.prod.yml

| Feature              | Development (`docker-compose.yml`)                            | Production (`docker-compose.prod.yml`)                    |
|----------------------|---------------------------------------------------------------|-----------------------------------------------------------|
| **Services**         | InfluxDB, Grafana, Telegraf, toy API                          | Same                                                      |
| **k6 and Artillery** | Profile `runners`, one container per run                      | Same                                                      |
| **Auto-restart**     | Telegraf only (`restart: unless-stopped`)                     | InfluxDB, Grafana, Telegraf, toy API                      |
| **Health checks**    | InfluxDB, Grafana, toy API                                    | Same                                                      |
| **Container names**  | `<project>-<service>-1`                                       | Same                                                      |
| **Start**            | `ltlab start` (builds the runner images, then `up -d --wait`) | `npm run start:prod`, or `ltlab start` with `COMPOSE_FILE` set |
| **Runs**             | `ltlab k6`, `ltlab artillery`, `ltlab chaos`, `ltlab run`     | The same with `COMPOSE_FILE` set, or `docker compose -f docker-compose.prod.yml run --rm ...` |
| **Local overrides**  | `docker-compose.override.yml` is merged automatically         | Not merged unless passed with another `-f`                |
| **Networks**         | `ltl-net` bridge                                              | `ltl-net` bridge                                          |
| **Volumes**          | `influxdb-data`; Grafana has none                             | Same                                                      |

### Environment Variables

Both modes use the lab's `.env` file. The only line that differs is `COMPOSE_FILE=docker-compose.prod.yml`, when you want `ltlab` to drive the production file.

---

## 🐛 Troubleshooting

### Issue: A service keeps restarting

**Diagnosis:**
```bash
# The status column shows "Restarting"
docker compose -f docker-compose.prod.yml ps

# Why the service stops
docker compose -f docker-compose.prod.yml logs --tail=50 <service>
```

**Common causes:**
- Configuration errors in `.env` (for example, InfluxDB requires a password of at least 8 characters)

**Stop a service while you fix it:**
```bash
docker compose -f docker-compose.prod.yml stop <service>
```

### Issue: A service does not start

If `npm run start:prod` stops with "port is already allocated", another program uses one of the lab's ports. Set `GRAFANA_PORT`, `INFLUXDB_PORT_EXPORT` or `TOY_API_PORT` in `.env` and start again.

### Issue: High CPU/Memory usage

**Monitor:**
```bash
docker stats
```

**Solutions:**
- Reduce virtual users (VUs) or arrival rates in test scenarios
- Increase resources allocated to Docker

### Issue: Metrics not appearing in Grafana

```bash
# Check InfluxDB is running and healthy
docker compose -f docker-compose.prod.yml ps influxdb

# Check the token in .env is the one InfluxDB knows
npm run check-influx

# Check InfluxDB and Telegraf logs
docker compose -f docker-compose.prod.yml logs influxdb
docker compose -f docker-compose.prod.yml logs telegraf
```

See [DIAGNOSIS_AND_SOLUTION.md](DIAGNOSIS_AND_SOLUTION.md) for how the token and the k6 output work, and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more cases.

---

## 💡 Best Practices

1. **Create `.env` with `ltlab configure` first**
   - It generates the token that InfluxDB adopts on its first start
   - `.env` is git-ignored; keep it out of shared places

2. **Monitor resource usage**
   - Keep `docker stats` open in a terminal
   - Watch for CPU throttling or memory limits

3. **Use development mode for day-to-day work**
   - The `ltlab` commands (`start`, `restart`, `info`, `k6`, `chaos`...) work with `docker-compose.yml`

4. **Clean up after tests**
   - Run `npm run stop:prod` when done
   - Free up system resources

5. **Log size for long tests**
   - For 24h+ tests, consider forwarding logs to an external system
   - Docker's default json-file log driver can consume disk space

6. **Set resource limits**
   - Add resource constraints to a service in the compose file to prevent a runaway container:

   ```yaml
   k6:
     # ...
     deploy:
       resources:
         limits:
           cpus: '2'
           memory: 1G
         reservations:
           cpus: '0.5'
           memory: 512M
   ```

---

## 📚 Related Documentation

- [README.md](README.md) - Documentation hub
- [DIAGNOSIS_AND_SOLUTION.md](DIAGNOSIS_AND_SOLUTION.md) - How the k6 to InfluxDB pipeline works
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute
- [cli/README.md](../cli/README.md) - CLI documentation
- [Blog: CI/CD Integration](https://destbreso.com/blog/load-tests-in-ci-cd) - Automating load tests
- [Blog: Performance Optimization](https://destbreso.com/blog/from-load-test-metrics-to-performance-fixes) - Production optimization insights

---

**Maintained by:** Load Testing Lab Team
