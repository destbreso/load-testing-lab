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

### Check All Services

```bash
# View service status
docker-compose ps

# Expected output:
# NAME       SERVICE    STATUS    PORTS
# influxdb   influxdb   Up        0.0.0.0:8086->8086/tcp
# grafana    grafana    Up        0.0.0.0:3000->3000/tcp
# toy-api    toy-api    Up        0.0.0.0:5000->5000/tcp
# telegraf   telegraf   Up        8092/udp, 8094/tcp, 8125/udp
```

### Check Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs influxdb
docker-compose logs grafana
docker-compose logs k6

# Follow logs in real-time
docker-compose logs -f influxdb
```

### Validate Token

```bash
# Check InfluxDB connectivity and token
node scripts/check-influx-token.js

# Expected output:
# ✅ InfluxDB Connection: OK
# ✅ Token Valid: yes
# ✅ Bucket 'loadtests' exists: yes
```

---

## Services Not Starting

### Problem: Docker Compose fails to start

**Symptoms:**
- `docker-compose up -d` returns errors
- Services show "Exited" status
- Port conflict errors

**Solutions:**

**1. Port conflicts**
```bash
# Check what's using the ports
lsof -i :8086  # InfluxDB
lsof -i :3000  # Grafana
lsof -i :5000  # Toy API

# Kill conflicting process or change ports in docker-compose.yml
```

**2. Insufficient disk space**
```bash
# Check disk space
df -h

# Clean up Docker
docker system prune -a
docker volume prune
```

**3. Docker daemon not running**
```bash
# Start Docker Desktop (macOS/Windows)
# Or start Docker service (Linux)
sudo systemctl start docker
```

### Problem: Services start but become unhealthy

**Check health:**
```bash
docker-compose ps
docker inspect influxdb --format='{{.State.Health.Status}}'
```

**Solution:**
```bash
# Restart unhealthy service
docker-compose restart influxdb

# Or full restart
docker-compose down
docker-compose up -d
```

---

## No Data in Grafana

### Problem: Grafana shows "No Data" in dashboards

**Possible causes:**

#### 1. No tests have been run yet

**Solution:**
```bash
# Run a quick test
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js

# Verify data in InfluxDB
node scripts/check-influx-token.js
```

#### 2. Incorrect time range in Grafana

**Solution:**
- Open Grafana dashboard
- Click time picker (top right)
- Change to "Last 1 hour" or "Last 15 minutes"
- Refresh dashboard

#### 3. Wrong InfluxDB token in Grafana

**Solution:**
```bash
# Verify token matches
cat .env | grep INFLUXDB_TOKEN
cat grafana/provisioning/datasources/influxdb.yaml | grep token

# If different, regenerate and sync
node scripts/generate-influx-token.js --update-env

# Update Grafana datasource
# Edit grafana/provisioning/datasources/influxdb.yaml
# Replace token in secureJsonData.token

# Restart Grafana
docker-compose restart grafana
```

#### 4. InfluxDB not receiving data

**Check if k6 is sending data:**
```bash
# Run test with verbose output
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js

# Should see:
# ✅ K6 InfluxDB configured:
#    Organization: myorg
#    Bucket: loadtests
# output: InfluxDBv2 (http://influxdb:8086)
```

**Verify data in InfluxDB:**
```bash
# Query InfluxDB directly
curl -X POST "http://localhost:8086/api/v2/query?org=myorg" \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests") |> range(start: -1h) |> limit(n:10)'
```

---

## k6 Issues

### Problem: "output: InfluxDBv2" not showing

**Cause:** k6 not configured to send to InfluxDB

**Solution:**
```bash
# Check k6/entrypoint.sh exists and has execute permissions
ls -la k6/entrypoint.sh
chmod +x k6/entrypoint.sh

# Rebuild k6 image
docker-compose build k6

# Test again
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js
```

### Problem: "the Bucket option is required" error

**Cause:** k6/entrypoint.sh not executing or missing permissions

**Solution:**
```bash
# Grant permissions
chmod +x k6/entrypoint.sh

# Rebuild image
docker-compose build k6

# Test
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js
```

### Problem: k6 test fails with connection errors

**Symptoms:**
```
ERRO[0001] GoError: Get "http://toy-api:5000/fast": dial tcp: lookup toy-api: no such host
```

**Solution:**
```bash
# Ensure toy-api is running
docker-compose ps toy-api

# Check network
docker network ls
docker network inspect load-testing-lab_default

# Restart all services
docker-compose down
docker-compose up -d
sleep 10
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js
```

### Problem: "insufficient VUs, decrease rate" warning

**Cause:** Not enough VUs allocated for arrival rate

**Solution:**
```bash
# Increase maxVUs in scenario or reduce rate
# Option 1: Override in command
docker-compose run --rm -e CONCURRENCY=200 k6 run /k6/scenarios/toy-fast.js

# Option 2: Edit scenario file
# Increase preAllocatedVUs and maxVUs values
```

---

## Artillery Issues

### Problem: Artillery not sending metrics to InfluxDB

**Cause:** Artillery doesn't have native InfluxDB v2 support

**Solution:** Use Telegraf integration (already configured)

**Verify Telegraf is running:**
```bash
docker-compose ps telegraf

# Check Telegraf logs
docker-compose logs telegraf
```

**Run Artillery test:**
```bash
docker-compose run --rm artillery run /artillery/scenarios/toy-fast.yml
```

**Check metrics arrived:**
```bash
# Wait 30 seconds after test
# Open Grafana: http://localhost:3000
# Check "Artillery - Basic (Telegraf)" dashboard
```

### Problem: Artillery test completes but no metrics

**Check Telegraf configuration:**
```bash
# View Telegraf config
cat telegraf/telegraf.conf

# Verify StatsD input is enabled
grep -A 5 "\[inputs.statsd\]" telegraf/telegraf.conf
```

**Restart Telegraf:**
```bash
docker-compose restart telegraf
```

---

## InfluxDB Issues

### Problem: InfluxDB connection refused

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:8086
```

**Solutions:**

**1. InfluxDB not ready yet**
```bash
# Wait for InfluxDB to initialize (5-10 seconds)
docker-compose logs influxdb | grep "Started HTTP"

# When you see "Started HTTP", it's ready
```

**2. InfluxDB crashed or unhealthy**
```bash
# Check status
docker-compose ps influxdb

# View logs
docker-compose logs influxdb

# Restart
docker-compose restart influxdb
```

### Problem: Cannot access InfluxDB UI

**Check UI is accessible:**
```bash
curl http://localhost:8086/health

# Should return: {"status":"pass"}
```

**If not accessible:**
```bash
# Check port mapping
docker-compose ps influxdb

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

**Solutions:**

**1. Token expired or invalid**
```bash
# Generate new token
node scripts/generate-influx-token.js

# Copy token to .env
# Update INFLUXDB_TOKEN=<new-token>
```

**2. Token mismatch between services**
```bash
# Verify all services use same token
cat .env | grep INFLUXDB_TOKEN
cat grafana/provisioning/datasources/influxdb.yaml | grep token

# If different, update Grafana:
# Edit grafana/provisioning/datasources/influxdb.yaml
# Replace secureJsonData.token with token from .env

# Restart Grafana
docker-compose restart grafana
```

**3. Bucket or organization mismatch**
```bash
# Verify bucket exists
curl "http://localhost:8086/api/v2/buckets?org=myorg" \
  -H "Authorization: Token YOUR_TOKEN"

# Should list "loadtests" bucket
```

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
# - Run fewer replicas in production mode
```

#### 2. Too many VUs for system

**Solution:**
```bash
# Reduce concurrency
docker-compose run --rm -e CONCURRENCY=25 k6 run /k6/scenarios/toy-fast.js

# Or edit scenario file to lower VU count
```

#### 3. Target API is slow

**Check target response times:**
```bash
# Test target directly
curl -w "@curl-format.txt" -o /dev/null -s http://toy-api:5000/fast

# If slow, the API is the bottleneck (expected behavior for testing)
```

### Problem: Docker consuming too much memory

**Solution:**
```bash
# Stop all services
docker-compose down

# Clean up resources
docker system prune -a
docker volume prune

# Restart with limited resources
docker-compose up -d

# Or configure limits in docker-compose.yml:
# deploy:
#   resources:
#     limits:
#       memory: 512M
```

---

## Production Mode Issues

### Problem: Container name conflicts

**Symptoms:**
```
Error: Conflict. The container name "/k6" is already in use
```

**Solution:**
```bash
# Stop development mode first
docker-compose down

# Then start production mode
docker-compose -f docker-compose.prod.yml up -d
```

### Problem: Replicas not scaling

**Cause:** `deploy.replicas` doesn't work in standalone docker-compose

**Solution:**
```bash
# Use --scale flag
docker-compose -f docker-compose.prod.yml up -d --scale k6=5 --scale artillery=3
```

### Problem: Auto-restart causing loops

**Symptoms:**
- Containers constantly restarting
- High restart count in `docker-compose ps`

**Solution:**
```bash
# View why containers are restarting
docker-compose -f docker-compose.prod.yml logs --tail=50 k6

# Fix underlying issue (missing dependencies, config errors)

# Or temporarily stop auto-restart
docker-compose -f docker-compose.prod.yml stop k6
```

### Problem: High resource usage with replicas

**Solution:**
```bash
# Check resource usage
docker stats

# Scale down if needed
docker-compose -f docker-compose.prod.yml up -d --scale k6=2 --scale artillery=1

# Or stop production mode
docker-compose -f docker-compose.prod.yml down
```

---

## Still Having Issues?

If you're still experiencing problems:

1. **Check detailed logs:**
   ```bash
   docker-compose logs --tail=100 > logs.txt
   ```

2. **Review technical documentation:**
   - [DIAGNOSIS_AND_SOLUTION.md](DIAGNOSIS_AND_SOLUTION.md) - Deep technical troubleshooting
   - [PRODUCTION_MODE.md](PRODUCTION_MODE.md) - Production-specific issues
   - [Blog: Performance Optimization](../blog/advanced/art8.md) - Diagnosing bottlenecks

3. **Reset everything (nuclear option):**
   ```bash
   # ⚠️ WARNING: This deletes all data and containers
   docker-compose down -v
   docker system prune -a
   rm -rf influxdb/data grafana/data
   
   # Start fresh
   docker-compose up -d
   ```

4. **Get help:**
   - [GitHub Issues](https://github.com/destbreso/load-testing-lab/issues)
   - Check [Blog Series](../blog/README.md) for tutorials
   - Review [Setup Guide](SETUP.md) for proper configuration

---

**Last Updated:** January 29, 2026
