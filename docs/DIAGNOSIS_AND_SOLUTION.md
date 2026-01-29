# 🔧 Diagnosis and Solution: Load Testing Lab

> **Technical troubleshooting document**  
> For daily use and Quick Start, see [README.md](README.md)

---

## 📋 Problem Summary

The **load-testing-lab** project exhibited the following symptoms:

- ✅ Docker containers started correctly
- ✅ k6 and Artillery tests executed
- ❌ **No data was stored in InfluxDB**
- ❌ **Grafana showed no data** (empty dashboards)
- ❌ **Unable to access data from Grafana**

---

## 🔍 Identified Problems

### 1. **K6 was not sending data to InfluxDB**

**Problem:** The `K6_OUT` environment variable was commented out in `docker-compose.yml`, so k6 didn't know where to send metrics.

**Location:** [docker-compose.yml](docker-compose.yml#L97-L105)

```yaml
# ❌ BEFORE (commented out)
# - K6_OUT=xk6-influxdb=http://influxdb:8086?org=${INFLUXDB_ORG}&bucket=${INFLUXDB_BUCKET}&token=${INFLUXDB_TOKEN}
```

**Solution applied:** 

- Created a custom `entrypoint.sh` script that configures the correct environment variables for xk6-influxdb
- The `xk6-influxdb` extension requires specific variables: `K6_INFLUXDB_ORGANIZATION`, `K6_INFLUXDB_BUCKET`, `K6_INFLUXDB_TOKEN`, etc.

### 2. **Docker Compose does not expand variables within values**

**Problem:** Docker Compose does not expand environment variables within the values of other environment variables. For example:

```yaml
- K6_OUT=xk6-influxdb=...?org=${INFLUXDB_ORG}  # ❌ ${INFLUXDB_ORG} does NOT expand
```

**Solution applied:** 

- Created an `entrypoint.sh` that dynamically builds configuration variables using the available environment variables

### 3. **Incorrect Grafana token**

**Problem:** The token configured in Grafana (`influxdb.yaml`) was different from the actual InfluxDB token configured in `.env`.

**Location:** [grafana/provisioning/datasources/influxdb.yaml](grafana/provisioning/datasources/influxdb.yaml#L14)

```yaml
# ❌ BEFORE
secureJsonData:
  token: 0XiVXLihj4Renb-sZPKQmIZ_35ot9x6DnryaiIN1rQAgHkXfDXmnTemWJcU69GI5M8dzZVeFfCPvzoMtAZsaRA==

# ✅ AFTER (synchronized with .env)
secureJsonData:
  token: 6jK9Va9JAtKbDmX9OXDfF5Bn7qpgsQIVpFWir_HXU91oXOr9-62bIrWLfDm_3R7AsT3eaQBSBt-o8t6ELGUDhQ==
```

### 4. **k6 scripts with incorrect references**

**Problem:** Some scripts tried to import a `config` variable that didn't exist.

**Location:** [k6/scenarios/inspection-flow.js](k6/scenarios/inspection-flow.js#L17)

```javascript
// ❌ BEFORE
export let options = config; // config is not defined

// ✅ AFTER
import config from "../k6.config.js";
export let options = config;
```

---

## ✅ Implemented Solutions

### 1. Created `k6/entrypoint.sh`

Script that correctly configures environment variables for xk6-influxdb:

```bash
#!/bin/sh
export K6_INFLUXDB_ORGANIZATION="$INFLUXDB_ORG"
export K6_INFLUXDB_BUCKET="$INFLUXDB_BUCKET"
export K6_INFLUXDB_TOKEN="$INFLUXDB_TOKEN"
export K6_INFLUXDB_ADDR="http://influxdb:8086"
export K6_INFLUXDB_INSECURE=true
export K6_OUT="xk6-influxdb"

exec /usr/bin/k6 "$@"
```

### 2. Updated `k6/Dockerfile`

Modified to copy and use the custom entrypoint:

```dockerfile
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

### 3. Updated `docker-compose.yml`

Removed entrypoint override to use the one configured in the Dockerfile.

### 4. Fixed token in `grafana/provisioning/datasources/influxdb.yaml`

Synchronized the token with the one in the `.env` file.

### 5. Fixed k6 scripts

- [k6/scenarios/inspection-flow.js](k6/scenarios/inspection-flow.js): Added config import
- [k6/scenarios/toy-fast.js](k6/scenarios/toy-fast.js): Cleaned configuration

---

## ✅ Solution Verification

### Test executed successfully:

```bash
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js
```

**Result:**
```
✅ K6 InfluxDB configured:
   Organization: myorg
   Bucket: loadtests
   Addr: http://influxdb:8086

output: InfluxDBv2 (http://influxdb:8086)  # ✅ Confirmed!

HTTP
http_req_duration: avg=2.91ms min=135.25µs med=902.77µs
http_req_failed: 0.00% (0 out of 1460)
http_reqs: 1460 (286.23/s)
```

### Data verified in InfluxDB:

```bash
curl "http://localhost:8086/api/v2/query?org=myorg" \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "loadtests") |> range(start: -1h) |> limit(n:5)'
```

**Result:** ✅ Data present (data_received, data_sent, http_req_duration, etc.)

---

## 🚀 How to Use Now

### 1. Start the complete stack:

```bash
docker-compose up -d
```

### 2. Run a k6 test:

```bash
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js
```

### 3. View metrics in Grafana:

- URL: http://localhost:3081
- User: `admin`
- Password: `admin123`

Dashboards should now display data correctly.

---

## 📝 Pending / Limitations

### Artillery does NOT send data to InfluxDB

**Problem:** Artillery has no native support for InfluxDB v2.

**Options to resolve:**

#### Option 1: Use a custom plugin (Recommended)
Artillery has plugins to send metrics:

- `artillery-plugin-publish-metrics` (for InfluxDB v1 with compatibility)
- Create a custom plugin that uses the InfluxDB v2 API

#### Option 2: Use Telegraf as intermediary
1. Add Telegraf to the stack
2. Configure Artillery to send to StatsD/Telegraf
3. Telegraf sends to InfluxDB v2

#### Option 3: Log parser
1. Artillery writes logs in JSON format
2. A script parses and sends to InfluxDB

**Recommendation:** If Artillery is critical for your project, implementing Option 2 (Telegraf) is the most robust.

---

## 🔧 Modified Files

1. ✅ `k6/entrypoint.sh` - Created
2. ✅ `k6/Dockerfile` - Updated
3. ✅ `docker-compose.yml` - Updated
4. ✅ `grafana/provisioning/datasources/influxdb.yaml` - Token fixed
5. ✅ `k6/scenarios/inspection-flow.js` - Import added
6. ✅ `k6/scenarios/toy-fast.js` - Cleaned

---

## 📚 Additional Resources

- **[README.md](README.md)** - Main documentation with Quick Start and FAQ
- **[ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md)** - Artillery integration guide
- [xk6-influxdb Documentation](https://github.com/grafana/xk6-output-influxdb)
- [InfluxDB v2 API](https://docs.influxdata.com/influxdb/v2.0/api/)
- [Grafana Datasource Configuration](https://grafana.com/docs/grafana/latest/datasources/influxdb/)

---

## 🎯 Conclusion

**Main problem resolved:** ✅ k6 now correctly sends data to InfluxDB and Grafana visualizes it.

**Pending problem:** ⚠️ Artillery still doesn't send data (requires additional configuration with plugins or Telegraf).

**Project status:** 🟢 Functional for k6, 🟡 Partially functional for Artillery.

---

## 🏭 Production Mode (docker-compose.prod.yml)

### When to Use Production Mode

Production mode (`docker-compose.prod.yml`) is designed for:

- ✅ **High-scale load testing** with multiple concurrent test runners
- ✅ **Soak/endurance tests** running for hours or days with auto-recovery
- ✅ **Stress testing** to find system breaking points
- ✅ **CI/CD pipeline integration** with automated restarts

### Common Issues in Production Mode

#### 1. **Container names conflict with development mode**

**Problem:** Running production mode while development containers are still up causes conflicts.

**Solution:**
```bash
# Stop development mode first
docker-compose down

# Then start production mode
npm run start:prod
```

#### 2. **Replicas not scaling as expected**

**Problem:** `deploy.replicas` doesn't work in standalone docker-compose (only in Swarm mode).

**Solution:** Use `--scale` flag instead:
```bash
docker-compose -f docker-compose.prod.yml up -d --scale k6=5 --scale artillery=3
```

#### 3. **Load not distributing across replicas**

**Symptom:** Multiple k6/Artillery instances running but load seems to come from only one.

**Diagnosis:**
```bash
# Check all running instances
docker-compose -f docker-compose.prod.yml ps

# View logs from all replicas
docker-compose -f docker-compose.prod.yml logs k6
docker-compose -f docker-compose.prod.yml logs artillery
```

**Common causes:**
- Test scenario not designed for distributed execution
- Each replica runs the same test independently (this is expected behavior)
- To distribute load, each instance should target the same endpoint

#### 4. **Auto-restart causing unexpected behavior**

**Problem:** Containers keep restarting in loops due to `restart: unless-stopped` policy.

**Diagnosis:**
```bash
# Check restart count
docker-compose -f docker-compose.prod.yml ps

# View why containers are restarting
docker-compose -f docker-compose.prod.yml logs --tail=50 <service_name>
```

**Solution:** Fix underlying issues (missing dependencies, config errors) or temporarily stop:
```bash
docker-compose -f docker-compose.prod.yml stop <service_name>
```

#### 5. **High resource usage with multiple replicas**

**Symptom:** System becomes slow or unresponsive with many replicas running.

**Monitoring:**
```bash
# Check resource usage
docker stats

# Check specific service
docker-compose -f docker-compose.prod.yml ps
```

**Solution:** Reduce replicas or increase system resources:
```bash
# Scale down
docker-compose -f docker-compose.prod.yml up -d --scale k6=2 --scale artillery=1
```

### Production Mode Best Practices

1. **Monitor resource usage** before scaling up
2. **Start with low replicas** (2-3) and scale gradually
3. **Use development mode for debugging** - it's easier to troubleshoot with single instances
4. **Check logs regularly** when running long soak tests
5. **Plan capacity** - each k6/Artillery replica needs CPU and memory
6. **Clean up after tests** - `npm run stop:prod` to free resources

---

**Last updated:** January 29, 2026  
**Version:** 1.1  
**Maintained by:** David Estevez
