# Production Mode Guide

> **Complete guide for using docker-compose.prod.yml for high-scale load testing**

---

## 📖 Overview

The Load Testing Lab provides two Docker Compose configurations:

- **`docker-compose.yml`** (Development) - Single instances, easy debugging, iterative testing
- **`docker-compose.prod.yml`** (Production) - Multiple replicas, auto-restart, high-scale scenarios

This guide covers when and how to use **Production Mode** effectively.

---

## 🎯 When to Use Production Mode

### ✅ **Use Production Mode when:**

1. **Generating High Load**
   - Single k6/Artillery instance can't generate enough requests per second
   - Need to test API capacity beyond what one load generator can produce
   - Target: >10,000 RPS or >1,000 concurrent virtual users

2. **Running Long Duration Tests**
   - Soak tests (hours or days of sustained load)
   - Endurance tests to find memory leaks or gradual degradation
   - Need auto-recovery if a test container crashes

3. **Stress Testing to Breaking Point**
   - Need to overwhelm your system to find limits
   - Multiple load sources help identify distributed system issues
   - Testing cascade failures and recovery

4. **CI/CD Pipeline Integration**
   - Automated performance tests in deployment pipelines
   - Need reproducible, scalable test environment
   - Auto-restart ensures reliability in unattended runs

5. **Simulating Distributed Traffic**
   - Multiple geographic regions
   - Multiple user segments hitting different endpoints
   - Real-world traffic patterns with varied load sources

### ❌ **Don't use Production Mode when:**

1. **Learning or Experimenting**
   - Development mode is simpler and faster to troubleshoot
   - Easier to see what each component is doing

2. **Quick Validation Tests**
   - Single scenario run for functional testing
   - Development mode starts faster and uses fewer resources

3. **Debugging Test Scenarios**
   - Fixed container names make logs easier to follow
   - Simpler to attach debuggers or inspect state

4. **Resource Constrained Environment**
   - Running on laptop with limited CPU/RAM
   - Development mode is more efficient for local testing

---

## 🚀 Getting Started

### Start Production Mode

```bash
# Using npm script (recommended)
npm run start:prod

# Or directly
docker-compose -f docker-compose.prod.yml up -d
```

**What starts:**
- InfluxDB (1 instance) with auto-restart
- Grafana (1 instance) with auto-restart  
- Telegraf (1 instance) with auto-restart
- k6 (3 replicas by default)
- Artillery (2 replicas by default)
- Toy API (1 instance) with auto-restart

### Verify Services

```bash
# Check all containers
docker-compose -f docker-compose.prod.yml ps

# You should see multiple k6 and artillery containers
# Example output:
#   k6_1, k6_2, k6_3
#   artillery_1, artillery_2
```

### Stop Production Mode

```bash
# Using npm script
npm run stop:prod

# Or directly
docker-compose -f docker-compose.prod.yml down
```

---

## 📊 Scaling Replicas

### Static Scaling (at startup)

Edit `docker-compose.prod.yml`:

```yaml
k6:
  # ... other config ...
  deploy:
    replicas: 5  # Change from 3 to 5
```

Then restart:
```bash
npm run stop:prod
npm run start:prod
```

### Dynamic Scaling (while running)

**Recommended method:**

```bash
# Scale k6 to 5 instances
REPLICAS=5 npm run scale:k6

# Scale Artillery to 4 instances
REPLICAS=4 npm run scale:artillery
```

**Direct docker-compose method:**

```bash
# Scale k6 to 5 instances
docker-compose -f docker-compose.prod.yml up -d --scale k6=5

# Scale Artillery to 4 instances
docker-compose -f docker-compose.prod.yml up -d --scale artillery=4

# Scale both at once
docker-compose -f docker-compose.prod.yml up -d --scale k6=5 --scale artillery=3
```

### Check Current Scale

```bash
docker-compose -f docker-compose.prod.yml ps | grep -E "k6|artillery"
```

---

## 🏃 Running Tests in Production Mode

### Important: How Replicas Work

Each replica runs **independently**. If you run:

```bash
docker-compose -f docker-compose.prod.yml run --rm k6 run /k6/scenarios/stress.js
```

Only **one** new k6 container executes the test (not all replicas).

### Running Distributed Load

To use all replicas for load generation, you need to trigger each one:

**Option 1: Use a loop (simple but works)**

```bash
# Run test on all 3 k6 replicas simultaneously
for i in {1..3}; do
  docker-compose -f docker-compose.prod.yml exec -d k6_$i k6 run /k6/scenarios/stress.js
done
```

**Option 2: Use a orchestration script**

Create `scripts/run-distributed-k6.sh`:

```bash
#!/bin/bash
SCENARIO=$1
REPLICAS=${2:-3}

echo "Running $SCENARIO on $REPLICAS k6 instances..."

for i in $(seq 1 $REPLICAS); do
  echo "Starting k6_$i..."
  docker-compose -f docker-compose.prod.yml exec -d k6_$i k6 run /k6/scenarios/$SCENARIO
done

echo "All instances started. Check Grafana for combined metrics."
```

Usage:
```bash
bash scripts/run-distributed-k6.sh stress.js 5
```

**Option 3: Design scenarios for coordination**

Advanced scenarios can coordinate via shared state (Redis, etc.) but this requires custom logic.

---

## 📈 Monitoring Production Mode

### View Combined Metrics in Grafana

All replicas send metrics to the same InfluxDB bucket, so Grafana automatically aggregates them.

- **Total RPS** = sum of all k6/Artillery instances
- **Latency percentiles** = calculated across all requests from all instances
- **Error rates** = combined across all sources

Open Grafana: http://localhost:3000 (admin/admin123)

### View Individual Replica Logs

```bash
# All k6 instances
docker-compose -f docker-compose.prod.yml logs k6

# Specific k6 instance
docker-compose -f docker-compose.prod.yml logs k6_1
docker-compose -f docker-compose.prod.yml logs k6_2

# Follow logs in real-time
docker-compose -f docker-compose.prod.yml logs -f k6
```

### Resource Monitoring

```bash
# Overall Docker stats
docker stats

# Filter for k6/Artillery only
docker stats | grep -E "k6|artillery"
```

---

## 🔥 Common Use Cases

### 1. High RPS Stress Test

**Goal:** Generate 50,000 requests per second to find system breaking point.

```bash
# Start with 5 k6 instances
npm run start:prod
REPLICAS=5 npm run scale:k6

# Create a high-RPS scenario (k6/scenarios/stress-50k.js)
# Each instance targets ~10,000 RPS

# Run on all instances
for i in {1..5}; do
  docker-compose -f docker-compose.prod.yml exec -d load-testing-lab-k6-$i k6 run /k6/scenarios/stress-50k.js
done

# Monitor in Grafana
# Watch for: response times, error rates, when system starts degrading
```

### 2. 24-Hour Soak Test

**Goal:** Run sustained load for 24 hours to find memory leaks or gradual degradation.

```bash
# Start production mode (auto-restart enabled)
npm run start:prod

# Run long-duration scenario
docker-compose -f docker-compose.prod.yml run -d k6 run /k6/scenarios/soak-24h.js

# Check periodically
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f k6

# If a container crashes, it will auto-restart and continue
```

### 3. Gradual Ramp-Up Test

**Goal:** Start with 1 replica, scale up over time to simulate growing traffic.

```bash
npm run start:prod

# Start with 1 replica
docker-compose -f docker-compose.prod.yml up -d --scale k6=1
docker-compose -f docker-compose.prod.yml exec -d k6_1 k6 run /k6/scenarios/ramp.js

# After 10 minutes, scale to 3
docker-compose -f docker-compose.prod.yml up -d --scale k6=3
for i in {2..3}; do
  docker-compose -f docker-compose.prod.yml exec -d k6_$i k6 run /k6/scenarios/ramp.js
done

# After 20 minutes, scale to 5
docker-compose -f docker-compose.prod.yml up -d --scale k6=5
for i in {4..5}; do
  docker-compose -f docker-compose.prod.yml exec -d k6_$i k6 run /k6/scenarios/ramp.js
done
```

### 4. CI/CD Pipeline Integration

**Example GitHub Actions workflow:**

```yaml
name: Performance Test

on:
  push:
    branches: [main]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start Load Testing Lab
        run: |
          npm install
          npm run start:prod
          sleep 30  # Wait for services to be ready
      
      - name: Run performance test
        run: |
          docker-compose -f docker-compose.prod.yml run --rm k6 run /k6/scenarios/ci-test.js
      
      - name: Check performance thresholds
        run: |
          # k6 exits with code 99 if thresholds fail
          # GitHub Actions will fail the build
      
      - name: Cleanup
        if: always()
        run: npm run stop:prod
```

---

## ⚙️ Configuration Differences

### docker-compose.yml vs docker-compose.prod.yml

| Feature                | Development                         | Production                      |
|------------------------|-------------------------------------|---------------------------------|
| **k6 replicas**        | 1 (on-demand)                       | 3 default, scalable             |
| **Artillery replicas** | 1 (on-demand)                       | 2 default, scalable             |
| **Container names**    | Fixed (`k6`, `artillery`)           | Dynamic (`k6_1`, `k6_2`, etc.)  |
| **Auto-restart**       | No                                  | Yes (`restart: unless-stopped`) |
| **Startup time**       | Fast                                | Slower (more containers)        |
| **Resource usage**     | Low                                 | High (multiple replicas)        |
| **Debugging**          | Easy (fixed names, single logs)     | Harder (multiple containers)    |
| **Networks**           | `ltl-net` bridge                    | `ltl-net` bridge                |
| **Volumes**            | Same (shared dashboards, scenarios) | Same                            |

### Environment Variables

Both modes use the same `.env` file. No changes needed when switching between modes.

---

## 🐛 Troubleshooting

### Issue: Replicas not starting

**Check logs:**
```bash
docker-compose -f docker-compose.prod.yml logs k6
```

**Common causes:**
- Resource constraints (CPU, memory)
- Port conflicts (if using host networking)
- Configuration errors in docker-compose.prod.yml

### Issue: Only one replica seems to be working

**Diagnosis:**
```bash
# Check all containers are running
docker-compose -f docker-compose.prod.yml ps

# Check each replica's logs
docker-compose -f docker-compose.prod.yml logs k6_1
docker-compose -f docker-compose.prod.yml logs k6_2
```

**Fix:** Make sure you're triggering tests on all replicas (see "Running Tests" section).

### Issue: High CPU/Memory usage

**Monitor:**
```bash
docker stats
```

**Solutions:**
- Reduce number of replicas
- Reduce virtual users (VUs) in test scenarios
- Increase resources allocated to Docker

### Issue: Metrics not appearing in Grafana

**All replicas send to the same InfluxDB**, so metrics should appear. If not:

```bash
# Check InfluxDB is running
docker-compose -f docker-compose.prod.yml ps influxdb

# Check k6 can reach InfluxDB
docker-compose -f docker-compose.prod.yml exec k6_1 ping -c 3 influxdb

# Check InfluxDB logs
docker-compose -f docker-compose.prod.yml logs influxdb
```

See [DIAGNOSIS_AND_SOLUTION.md](DIAGNOSIS_AND_SOLUTION.md) for detailed troubleshooting.

---

## 💡 Best Practices

1. **Start small, scale gradually**
   - Begin with 2 replicas, verify everything works
   - Scale up incrementally while monitoring resources

2. **Monitor resource usage**
   - Keep `docker stats` open in a terminal
   - Watch for CPU throttling or memory limits

3. **Use development mode for debugging**
   - Switch to `docker-compose.yml` when troubleshooting scenarios
   - Fixed container names make debugging easier

4. **Clean up after tests**
   - Always run `npm run stop:prod` when done
   - Free up system resources

5. **Design scenarios with replicas in mind**
   - Each replica runs independently
   - Coordinate via external mechanism if needed (Redis, shared DB)
   - Or run separate scenarios on each replica for variety

6. **Log aggregation for long tests**
   - For 24h+ tests, consider forwarding logs to external system
   - Docker's default json-file driver can consume disk space

7. **Set resource limits**
   - Add resource constraints to prevent runaway containers:
   
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

- [README.md](README.md) - Main documentation and quick start
- [DIAGNOSIS_AND_SOLUTION.md](DIAGNOSIS_AND_SOLUTION.md) - Troubleshooting guide
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute
- [cli/README.md](cli/README.md) - CLI documentation
- [Blog: CI/CD Integration](../blog/advanced/art5.md) - Automating load tests
- [Blog: Performance Optimization](../blog/advanced/art8.md) - Production optimization insights

---

**Last updated:** January 26, 2026  
**Maintained by:** Load Testing Lab Team
