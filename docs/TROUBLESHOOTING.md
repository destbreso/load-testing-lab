# Troubleshooting Guide

Common issues and solutions for the Load Testing Lab.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Services Not Starting](#services-not-starting)
3. [No Data in Grafana](#no-data-in-grafana)
4. [k6 Issues](#k6-issues)
5. [Artillery Issues](#artillery-issues)
6. [InfluxDB Issues](#influxdb-issues)
7. [Token Problems](#token-problems)
8. [Performance Issues](#performance-issues)
9. [Production Mode Issues](#production-mode-issues)

---

## Quick Diagnostics

`ltlab` commands work from any directory. Plain `docker compose` commands run from the lab's folder and take service names (`influxdb`, `grafana`, `telegraf`, `toy-api`), not container names.

### Check All Services

```bash
# Configuration (token masked), each service's state and health, and the URLs
ltlab info

# Or, from the lab's folder
docker compose ps

# Expected (abridged):
# SERVICE    STATUS
# grafana    Up (healthy)
# influxdb   Up (healthy)
# telegraf   Up
# toy-api    Up (healthy)
```

k6 and Artillery do not appear: they run only during a test, in a container that is removed when the test ends.

### Check Logs

```bash
# All services
docker compose logs

# Specific service
docker compose logs influxdb
docker compose logs grafana
docker compose logs telegraf

# Follow logs in real-time
docker compose logs -f influxdb
```

k6 and Artillery print their output in the terminal that runs the test.

### Validate Token

```bash
# Check InfluxDB connectivity and the token in .env (from the lab's folder)
npm run check-influx

# Expected output:
# ✅ Token works! Buckets in org:
# - loadtests (ID: ...)
# (InfluxDB's own system buckets are listed too)
```

---

## Services Not Starting

### Problem: `ltlab start` fails

**Symptoms:**
- "There is no .env file yet." or "INFLUXDB_TOKEN is missing from .env."
- "Docker Compose v2 was not found"
- Port conflict errors
- A service never becomes healthy

**Solutions:**

**1. No .env, or no token in it**
```bash
# Create the lab's .env (it generates the InfluxDB token)
ltlab configure
ltlab start
```

**2. Docker Compose v2 missing**

The CLI needs Docker Compose v2: the `docker compose` plugin (included with Docker Desktop) or a standalone `docker-compose` v2 binary. Compose v1 is not supported.

```bash
docker compose version
```

**3. Port conflicts**
```bash
# Check what's using the ports
lsof -i :8086     # InfluxDB
lsof -i :3000     # Grafana
lsof -i :5000     # Toy API
lsof -i udp:8125  # Telegraf (StatsD)

# Stop the conflicting process, or move the lab's ports in .env:
# INFLUXDB_PORT_EXPORT, GRAFANA_PORT, TOY_API_PORT
```

**4. Insufficient disk space**
```bash
# Check disk space
df -h

# Clean up Docker (this removes unused images too; the next ltlab start builds the lab's images again)
docker system prune -a
docker volume prune
```

**5. Docker daemon not running**
```bash
# Start Docker Desktop (macOS/Windows)
# Or start Docker service (Linux)
sudo systemctl start docker
```

### Problem: Services start but become unhealthy

`ltlab start` waits for the health checks of InfluxDB, Grafana and the toy API, and fails when one of them does not pass.

**Check health:**
```bash
ltlab info
docker compose ps
docker compose logs influxdb
```

**Solution:**
```bash
# Recreate the unhealthy service
ltlab restart -s influxdb

# Or full restart
ltlab stop
ltlab start
```

If InfluxDB fails on its first start, check `INFLUXDB_PASSWORD` in `.env`: InfluxDB requires at least 8 characters (`ltlab configure` checks it, a hand-edited `.env` may not). After fixing it, `ltlab purge` and `ltlab start` run InfluxDB's setup again.

---

## No Data in Grafana

### Problem: Grafana shows "No Data" in dashboards

**Possible causes:**

#### 1. No tests have been run yet

**Solution:**
```bash
# Run a quick test
ltlab k6 -s toy-fast.js

# Show the latest rows in InfluxDB (from the lab's folder)
npm run tail-influx
```

#### 2. Incorrect time range in Grafana

**Solution:**
- Open Grafana dashboard
- The dashboards show the last 30 minutes and refresh every 5 seconds
- For an older run, click the time picker (top right) and widen the range
- Refresh dashboard

#### 3. Grafana started before a change to .env

Grafana's datasource reads `INFLUXDB_TOKEN`, `INFLUXDB_ORG` and `INFLUXDB_BUCKET` from `.env` when Grafana starts, and every dashboard queries that bucket.

**Solution:**
```bash
# Recreate Grafana with the current .env
ltlab restart -s grafana
```

If the token, organization or bucket in `.env` differs from what InfluxDB was set up with, see [Token Problems](#token-problems).

#### 4. InfluxDB not receiving data

**Check if k6 is sending data:**
```bash
ltlab k6 -s toy-fast.js

# Should see:
# ✅ K6 InfluxDB configured:
#    Organization: myorg
#    Bucket: loadtests
# output: InfluxDBv2 (http://influxdb:8086)
```

**Verify data in InfluxDB:**
```bash
# Query InfluxDB directly (YOUR_TOKEN is INFLUXDB_TOKEN in the lab's .env)
curl -X POST "http://localhost:8086/api/v2/query?org=myorg" \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests") |> range(start: -1h) |> limit(n:10)'
```

For Artillery, see [Artillery Issues](#artillery-issues).

---

## k6 Issues

### Problem: "output: InfluxDBv2" not showing

**Cause:** k6 not configured to send to InfluxDB. The k6 entrypoint (`k6/entrypoint.sh`) turns on the InfluxDB output only when `INFLUXDB_TOKEN`, `INFLUXDB_ORG` and `INFLUXDB_BUCKET` all have a value; otherwise the run prints "⚠️  WARNING: InfluxDB variables not configured, K6_OUT not available" and k6 runs without sending metrics.

**Solution:**
```bash
# Write the lab's .env, with its InfluxDB token
ltlab configure

# Test again
ltlab k6 -s toy-fast.js
```

### Problem: "invalid output type 'xk6-influxdb'"

**Cause:** the k6 binary in the image does not include the xk6-output-influxdb output, for example after building from a Dockerfile edited to newer versions: the extension is made for k6 v1, and a k6 v2 built with it does not register the output.

**Solution:**
```bash
# Rebuild from the lab's Dockerfile, which pins xk6 v1.4.14, k6 v1.8.1 and xk6-output-influxdb v0.7.0
ltlab rebuild -s k6
```

### Problem: the k6 container fails with a permission error on /entrypoint.sh

**Cause:** `k6/entrypoint.sh` lost its execute permission (the image copies it as it is on your machine)

**Solution:**
```bash
# Grant permissions
chmod +x k6/entrypoint.sh

# Rebuild image
ltlab rebuild -s k6

# Test
ltlab k6 -s toy-fast.js
```

### Problem: k6 test fails with connection errors

**Symptoms:**
```
WARN[0001] Request Failed  error="Get \"http://toy-api:5000/fast\": dial tcp: lookup toy-api ... no such host"
```

**Solution:**
```bash
# Ensure toy-api is running and healthy
ltlab info

# Start the lab if needed (it returns once the toy API is ready)
ltlab start

# Check network: the services share the network <project>_ltl-net
docker network ls
```

A container started with `docker run` is not on that network: run tests with `ltlab k6` or `docker compose run --rm k6 ...`.

For an API on your machine, `TARGET_API_URL=http://localhost:...` points at the k6 container itself: use `http://host.docker.internal:<port>` instead (on Linux, the API must listen on `0.0.0.0`).

### Problem: "Insufficient VUs" warning

**Cause:** an arrival-rate scenario (such as one generated from the variable-traffic blueprint) needs more virtual users than it may start; k6 counts the iterations it could not start in `dropped_iterations`.

**Solution:**
```bash
# Edit the scenario file:
# increase preAllocatedVUs and maxVUs, or lower the rate
```

### Problem: `ltlab k6` exits with code 99

**Cause:** a threshold of the scenario failed, and the THRESHOLDS section of k6's summary marks it with ✗. This is the test's verdict, not a lab error; in CI, it fails the job.

---

## Artillery Issues

### Problem: Artillery not sending metrics to InfluxDB

**Cause:** Artillery has no native InfluxDB v2 output. The lab uses Artillery's built-in publish-metrics plugin, which sends StatsD metrics to Telegraf, and Telegraf writes them to InfluxDB. A scenario sends metrics only when it declares the plugin (the built-in scenarios and the blueprints do):

```yaml
config:
  plugins:
    publish-metrics:
      - type: statsd
        host: "{{ $processEnvironment.STATSD_HOST }}"
        port: "{{ $processEnvironment.STATSD_PORT }}"
        prefix: "artillery."
```

**Verify Telegraf is running:**
```bash
docker compose ps telegraf

# Check Telegraf logs
docker compose logs telegraf
```

**Run Artillery test:**
```bash
ltlab artillery -s toy-fast.yml
```

**Check metrics arrived:**
```bash
# Artillery panels trail the run by up to about 20 seconds
# Open Grafana: http://localhost:3000
# Check the "Artillery + Telegraf - War Room" dashboard
```

### Problem: Artillery test completes but no metrics

**Check the prefix:** it must be `artillery.`, since Telegraf's templates and the dashboards read only the metrics whose names start with it.

**Check Telegraf configuration:**
```bash
# View Telegraf config
cat telegraf/telegraf.conf

# Verify StatsD input is enabled
grep -A 5 "\[\[inputs.statsd\]\]" telegraf/telegraf.conf
```

**Restart Telegraf:**
```bash
ltlab restart -s telegraf
```

### Problem: Scenario names cut short

**Cause:** StatsD cuts a metric name at its first space, so a scenario name with spaces does not reach InfluxDB intact.

**Solution:** name scenarios without spaces, in kebab-case like the lab's own (`mixed-chaos-scenario`, `retry-logic-testing`).

### Problem: `ltlab artillery` exits with code 1

**Cause:** usually an `ensure` check failed: Artillery prints "Checks:" and a `fail:` line for it (toy-fast.yml checks p95, p99 and the share of virtual users that did not complete). This is the test's verdict; in CI, it fails the job.

If a scenario's checks never print, list `ensure: {}` under `config.plugins`: Artillery loads the plugin only from there (see [Custom Artillery Scenarios](USAGE.md#custom-artillery-scenarios)).

---

## InfluxDB Issues

### Problem: InfluxDB connection refused

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:8086
```

`ltlab metrics` says "Cannot connect to InfluxDB" instead. This comes from the scripts that run on your machine (`ltlab reset`, `ltlab metrics`, `npm run check-influx`, `npm run tail-influx`). They reach InfluxDB at `http://localhost:<INFLUXDB_PORT_EXPORT>` (8086 by default), or at `INFLUXDB_URL` when it is set.

**Solutions:**

**1. The lab is not running**
```bash
# Start it (it returns once InfluxDB is healthy)
ltlab start
```

**2. InfluxDB crashed or unhealthy**
```bash
# Check status
ltlab info

# View logs (from the lab's folder)
docker compose logs influxdb

# Recreate it
ltlab restart -s influxdb
```

**3. INFLUXDB_URL points somewhere else**

`INFLUXDB_URL` overrides the local address. Set it only for an InfluxDB that runs somewhere else; without it, the scripts follow `INFLUXDB_PORT_EXPORT` on their own.

```bash
# The address in effect, from the lab's .env
ltlab info

# A value exported in your shell wins over .env
echo $INFLUXDB_URL
```

### Problem: Cannot access InfluxDB UI

**Check UI is accessible:**
```bash
curl http://localhost:8086/health

# Should report a status of "pass"
```

**If not accessible:**
```bash
# Check port mapping
docker compose ps influxdb

# Should show: 0.0.0.0:8086->8086/tcp

# Check firewall
# Ensure port 8086 is not blocked
```

---

## Token Problems

### Problem: "unauthorized access" errors

**Symptoms:**
```
Error: unauthorized access
401 Unauthorized
```

InfluxDB adopts `INFLUXDB_TOKEN` as its admin token only when it sets itself up, on its first start; k6, Telegraf and Grafana read the same value from `.env`.

**Solutions:**

**1. The token in .env is not the one InfluxDB was set up with**

This happens when `INFLUXDB_TOKEN` changes after the first start (edited by hand, or generated again by `ltlab configure` after `.env` was deleted) while the `influxdb-data` volume keeps the old setup.

```bash
# Check the token in .env against InfluxDB (from the lab's folder)
npm run check-influx
```

Then either:
- Put back in `.env` the token InfluxDB was set up with, then run `ltlab restart -s all`
- Or run `ltlab purge`, then `ltlab start`: InfluxDB sets itself up again with the token in `.env` (the stored metrics are deleted)
- Or create an all-access token in InfluxDB's UI (http://localhost:8086, logging in with the admin user and password it was set up with), set it as `INFLUXDB_TOKEN` in `.env`, then run `ltlab restart -s all`

**2. A service started before .env changed**
```bash
# Each service reads .env when it is created: recreate them all
ltlab restart -s all

# Show the start of the token in .env, and each service's health
ltlab info
```

**3. Bucket or organization mismatch**
```bash
# Verify bucket exists
curl "http://localhost:8086/api/v2/buckets?org=myorg" \
  -H "Authorization: Token YOUR_TOKEN"

# Should list "loadtests" bucket
```

Like the token, `INFLUXDB_ORG` and `INFLUXDB_BUCKET` are applied when InfluxDB sets itself up. After changing them in `.env`, `ltlab purge` and `ltlab start` set InfluxDB up again with the new values (the stored metrics are deleted).

---

## Performance Issues

### Problem: Tests running very slow

**Possible causes:**

#### 1. Resource constraints

**Check Docker resources:**
```bash
# View resource usage
docker stats

# If CPU/Memory maxed out:
# - Increase Docker Desktop resources
# - Reduce VUs/concurrency
```

#### 2. Too many VUs for system

**Solution:**
```bash
# Reduce concurrency for one run
ltlab k6 -s toy-fast.js -e CONCURRENCY=25

# Or edit scenario file to lower VU count
```

#### 3. Target API is slow

**Check target response times:**
```bash
# Test target directly (from your machine, the toy API answers on localhost:5000)
curl -o /dev/null -s -w '%{time_total}s\n' http://localhost:5000/fast

# If slow, the API is the bottleneck (expected behavior for testing)
```

### Problem: Docker consuming too much memory

**Solution:**
```bash
# Stop all services
ltlab stop

# Clean up resources
docker system prune -a
docker volume prune

# Start again
ltlab start
```

To cap a service's memory, add a `docker-compose.override.yml` next to `docker-compose.yml` (Compose reads it automatically, and git ignores it):

```yaml
services:
  toy-api:
    deploy:
      resources:
        limits:
          memory: 512M
```

---

## Production Mode Issues

### Problem: Auto-restart causing loops

**Symptoms:**
- Containers constantly restarting
- A "Restarting" status in `docker compose -f docker-compose.prod.yml ps`

**Solution:**
```bash
# View why containers are restarting
docker compose -f docker-compose.prod.yml logs --tail=50 influxdb

# Fix underlying issue (a wrong value in .env, a port already in use)

# Or temporarily stop auto-restart
docker compose -f docker-compose.prod.yml stop influxdb
```

---

## Still Having Issues?

If you're still experiencing problems:

1. **Check detailed logs:**
   ```bash
   docker compose logs --tail=100 > logs.txt
   ```

2. **Review technical documentation:**
   - [DIAGNOSIS_AND_SOLUTION.md](DIAGNOSIS_AND_SOLUTION.md) - Deep technical troubleshooting
   - [PRODUCTION_MODE.md](PRODUCTION_MODE.md) - Production-specific issues
   - [Blog: Performance Optimization](https://destbreso.com/blog/from-load-test-metrics-to-performance-fixes) - Diagnosing bottlenecks

3. **Reset everything (nuclear option):**
   ```bash
   # ⚠️ WARNING: This deletes all metrics, InfluxDB's setup and the lab's containers
   ltlab purge

   # Optional: also remove unused images (the next ltlab start builds the lab's images again)
   docker system prune -a

   # Start fresh (InfluxDB sets itself up again with the token in .env)
   ltlab start
   ```

4. **Get help:**
   - [GitHub Issues](https://github.com/destbreso/load-testing-lab/issues)
   - Check [Blog Series](https://destbreso.com/blog/series/load-testing-lab-guide) for tutorials
   - Review [Setup Guide](SETUP.md) for proper configuration
