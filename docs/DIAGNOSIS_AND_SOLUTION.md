# 🔧 Diagnosis and Solution: Load Testing Lab

> **Technical troubleshooting document**: how metrics get from k6 to InfluxDB, and the diagnosis that shaped it  
> For daily use and Quick Start, see [README.md](README.md)

---

## 📋 Problem Summary

The **load-testing-lab** project once exhibited the following symptoms:

- ✅ Docker containers started correctly
- ✅ k6 and Artillery tests executed
- ❌ **No data was stored in InfluxDB**
- ❌ **Grafana showed no data** (empty dashboards)
- ❌ **Unable to access data from Grafana**

The sections below record what caused it and describe how each piece works today.

---

## 🔍 Identified Problems

### 1. **K6 was not sending data to InfluxDB**

**Problem:** The `K6_OUT` environment variable was commented out in `docker-compose.yml`, so k6 didn't know where to send metrics.

**Location:** the `k6` service in [docker-compose.yml](../docker-compose.yml)

```yaml
# ❌ BEFORE (commented out)
# - K6_OUT=xk6-influxdb=http://influxdb:8086?org=${INFLUXDB_ORG}&bucket=${INFLUXDB_BUCKET}&token=${INFLUXDB_TOKEN}
```

**Solution applied:** 

- Created a custom `entrypoint.sh` script that configures the correct environment variables for xk6-influxdb
- The `xk6-influxdb` extension requires specific variables: `K6_INFLUXDB_ORGANIZATION`, `K6_INFLUXDB_BUCKET`, `K6_INFLUXDB_TOKEN`, etc.

### 2. **The extension is not configured through query parameters**

**Problem:** The commented-out line passed the organization, bucket and token as query parameters of `K6_OUT`. Docker Compose does substitute `${INFLUXDB_ORG}` and the others from `.env`, so substitution was never the issue: xk6-output-influxdb takes the address in `K6_OUT` but reads the organization, bucket and token from its own variables, `K6_INFLUXDB_ORGANIZATION`, `K6_INFLUXDB_BUCKET` and `K6_INFLUXDB_TOKEN`, not from query parameters. For example:

```yaml
- K6_OUT=xk6-influxdb=...?org=${INFLUXDB_ORG}  # ❌ the extension ignores these query parameters
```

**Solution applied:** 

- Created an `entrypoint.sh` that maps the lab's `INFLUXDB_*` variables to the extension's `K6_INFLUXDB_*` variables and enables the output only when the organization, bucket and token are all set

### 3. **Incorrect Grafana token**

**Problem:** The token configured in Grafana's datasource (`influxdb.yaml`) was different from the actual InfluxDB token configured in `.env`.

**Location:** [grafana/provisioning/datasources/influxdb.yaml](../grafana/provisioning/datasources/influxdb.yaml)

```yaml
# ❌ BEFORE: a token copied into the file, which drifted from .env
secureJsonData:
  token: <a token pasted into the file>

# ✅ NOW: no token in the file; Grafana reads it from its environment
secureJsonData:
  token: ${INFLUXDB_TOKEN}
```

The datasource reads `${INFLUXDB_TOKEN}`, `${INFLUXDB_ORG}` and `${INFLUXDB_BUCKET}` from Grafana's environment, which Compose fills from `.env`, so it cannot drift from the token the rest of the lab uses, and no token is committed in the repository. See [The token, from .env to every service](#4-the-token-from-env-to-every-service).

### 4. **k6 scripts with incorrect references**

**Problem:** Some scripts tried to import a `config` variable that didn't exist.

**Location:** a k6 scenario that is no longer in the repository

```javascript
// ❌ BEFORE
export let options = config; // config is not defined

// ✅ NOW: each scenario declares its options inline, as every scenario in k6/scenarios/ does
export const options = {
  vus: 10,
  duration: "30s",
};
```

---

## ✅ Implemented Solutions

### 1. `k6/entrypoint.sh`

The k6 image runs this script before k6. When `INFLUXDB_ORG`, `INFLUXDB_BUCKET` and `INFLUXDB_TOKEN` are all set, it maps them to the extension's variables and turns the output on (abridged):

```bash
#!/bin/sh
set -e

if [ -n "$INFLUXDB_BUCKET" ] && [ -n "$INFLUXDB_ORG" ] && [ -n "$INFLUXDB_TOKEN" ]; then
  export K6_INFLUXDB_ORGANIZATION="$INFLUXDB_ORG"
  export K6_INFLUXDB_BUCKET="$INFLUXDB_BUCKET"
  export K6_INFLUXDB_TOKEN="$INFLUXDB_TOKEN"
  export K6_INFLUXDB_ADDR="http://influxdb:8086"
  export K6_INFLUXDB_INSECURE=true
  export K6_OUT="xk6-influxdb"
  echo "✅ K6 InfluxDB configured:"
  # ...prints the organization, bucket and address
else
  echo "⚠️  WARNING: InfluxDB variables not configured, K6_OUT not available"
fi

exec /usr/bin/k6 "$@"
```

Without the three values, k6 still runs, but prints the warning and sends no metrics. The compose file gives the organization and bucket defaults (`myorg`, `loadtests`), so in practice the token in `.env` decides.

### 2. `k6/Dockerfile`: a pinned build

The image builds k6 with the extension and copies the binary onto the official k6 image, with the custom entrypoint (without its comments):

```dockerfile
FROM golang:1.26-alpine AS builder
ENV GOTOOLCHAIN=auto
RUN apk add --no-cache git
RUN go install go.k6.io/xk6/cmd/xk6@v1.4.14
WORKDIR /src
RUN xk6 build v1.8.1 --with github.com/grafana/xk6-output-influxdb@v0.7.0 --output /src/k6

FROM grafana/k6:0.49.0
COPY --from=builder /src/k6 /usr/bin/k6
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

Every version is pinned. xk6-output-influxdb is built for k6 v1: a build that picks k6 v2 leaves the extension out without an error, and k6 then rejects `K6_OUT=xk6-influxdb` as an invalid output type, so no metrics reach InfluxDB. `GOTOOLCHAIN=auto` lets the builder download a newer Go when xk6 or a dependency asks for one. To rebuild the image from scratch: `ltlab rebuild -s k6`.

### 3. `docker-compose.yml`

There is no entrypoint override for k6, so the Dockerfile's entrypoint runs. The `k6` service receives `INFLUXDB_TOKEN`, `INFLUXDB_ORG` (default `myorg`) and `INFLUXDB_BUCKET` (default `loadtests`) from `.env`. It belongs to the Compose profile `runners`, so it starts only for a run (`ltlab k6`, or `docker compose run --rm k6 ...`), and it waits until InfluxDB passes its health check.

### 4. The token, from `.env` to every service

- `ltlab configure` writes the lab's `.env` and generates `INFLUXDB_TOKEN` (64 hexadecimal characters) when there is none; it keeps an existing one
- On its first start, InfluxDB adopts that token as its admin token (`DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=${INFLUXDB_TOKEN}` in the compose file)
- k6 (through the entrypoint), Telegraf (its InfluxDB output) and Grafana (its provisioned datasource) read the same value from their environment
- `ltlab start` refuses to start without `.env` or without the token

InfluxDB adopts the token only at its first setup, which is kept on the `influxdb-data` volume. If `.env` later holds a different token, InfluxDB rejects it with a 401, and `npm run check-influx` shows it. To fix it, put back the token InfluxDB knows; or create a token in InfluxDB's UI, write it to `INFLUXDB_TOKEN` in `.env` and run `ltlab restart -s all`; or run `ltlab purge` and `ltlab start`, which sets InfluxDB up again with the token in `.env` and deletes every stored metric.

### 5. Fixed k6 scripts

- [k6/scenarios/toy-fast.js](../k6/scenarios/toy-fast.js): Cleaned configuration

---

## ✅ Solution Verification

### Test executed successfully:

```bash
ltlab k6 -s toy-fast.js

# Or, from the lab's root directory
docker compose run --rm k6 run /k6/scenarios/toy-fast.js
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
# Last rows written in the past hour, read with the lab's .env
npm run tail-influx

# Or with the InfluxDB API, from the lab's root directory
set -a; . ./.env; set +a
curl "http://localhost:${INFLUXDB_PORT_EXPORT:-8086}/api/v2/query?org=${INFLUXDB_ORG}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "'"${INFLUXDB_BUCKET:-loadtests}"'") |> range(start: -1h) |> limit(n:5)'
```

**Result:** ✅ Data present (data_received, data_sent, http_req_duration, etc.)

---

## 🚀 How to Use Now

### 1. Configure the lab (first time only):

```bash
npm install && npm link
ltlab configure
```

### 2. Start the complete stack:

```bash
ltlab start
```

It returns when every service is ready.

### 3. Run a k6 test:

```bash
ltlab k6 -s toy-fast.js
```

### 4. View metrics in Grafana:

- URL: http://localhost:3000
- User: `admin` (`GRAFANA_USER`)
- Password: `admin123` (`GRAFANA_PASSWORD`)

Dashboards should now display data correctly.

---

## 📝 Artillery and Limitations

**Artillery** has no InfluxDB v2 output of its own. The lab sends its metrics through Telegraf: Artillery's built-in publish-metrics plugin reports over StatsD (prefix `artillery.`), Telegraf receives StatsD and writes to InfluxDB, and the Artillery dashboards read the result. Counters such as requests and status codes arrive exactly, so the totals in InfluxDB equal Artillery's summary. See [ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md).

**Limitation:** Artillery sends percentiles already computed for each 10-second period, so InfluxDB cannot give an exact percentile for a whole Artillery run. The Artillery dashboards show each period's percentiles and, as stats, the highest value among them ("pXX, worst report"), an upper bound on the run's percentile. Artillery's end-of-test summary has the exact value. k6 stores every request's duration, so the k6 percentiles have no such limit.

---

## 🔧 Files Involved

1. ✅ `k6/entrypoint.sh` - Maps the lab's variables to the extension's and turns the output on
2. ✅ `k6/Dockerfile` - Pinned build of k6 with xk6-output-influxdb
3. ✅ `docker-compose.yml` - Passes the token, organization and bucket from `.env`; InfluxDB adopts the token on its first start
4. ✅ `grafana/provisioning/datasources/influxdb.yaml` - Reads the token, organization and bucket from Grafana's environment
5. ✅ `k6/scenarios/toy-fast.js` - Cleaned

---

## 📚 Additional Resources

- **[README.md](README.md)** - Documentation hub
- **[ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md)** - Artillery integration guide
- [xk6-influxdb Documentation](https://github.com/grafana/xk6-output-influxdb)
- [InfluxDB v2 API](https://docs.influxdata.com/influxdb/v2.0/api/)
- [Grafana Datasource Configuration](https://grafana.com/docs/grafana/latest/datasources/influxdb/)

---

## 🎯 Conclusion

**Main problem resolved:** ✅ k6 sends its metrics to InfluxDB, and Grafana visualizes them.

**Artillery:** ✅ its metrics reach InfluxDB through Telegraf, with exact totals.

**Project status:** 🟢 Functional for k6 and Artillery.

---

## 🏭 Production Mode (docker-compose.prod.yml)

### When to Use Production Mode

Production mode (`docker-compose.prod.yml`) is the same stack as `docker-compose.yml`, with `restart: unless-stopped` on InfluxDB, Grafana, Telegraf and the toy API. It is meant for:

- ✅ **A lab that stays up** on a shared machine, coming back after a crash or a reboot
- ✅ **Soak/endurance tests** running for hours or days, with the services restarted if they crash

It starts with `npm run start:prod` (`docker compose -f docker-compose.prod.yml up -d --wait`) and reads the same `.env`. k6 and Artillery still run one container per test. See [PRODUCTION_MODE.md](PRODUCTION_MODE.md).

### Common Issues in Production Mode

#### 1. **Switching between development and production mode**

**Situation:** Both files belong to the same Compose project and share the `influxdb-data` volume.

**Solution:** Stop the running stack before starting the other one:
```bash
# Stop development mode first
ltlab stop

# Then start production mode
npm run start:prod
```

#### 2. **Auto-restart causing unexpected behavior**

**Problem:** A container keeps restarting in a loop because of the `restart: unless-stopped` policy.

**Diagnosis:**
```bash
# Check which services are restarting
docker compose -f docker-compose.prod.yml ps

# View why containers are restarting
docker compose -f docker-compose.prod.yml logs --tail=50 <service_name>
```

**Solution:** Fix the underlying issue (for example, a missing token or a configuration error in `.env`), or temporarily stop the service:
```bash
docker compose -f docker-compose.prod.yml stop <service_name>
```

#### 3. **High resource usage**

**Symptom:** System becomes slow or unresponsive during long or heavy tests.

**Monitoring:**
```bash
# Check resource usage
docker stats

# Check the services
docker compose -f docker-compose.prod.yml ps
```

**Solution:** Reduce the virtual users or arrival rates of the scenario, or give Docker more resources.

### Production Mode Best Practices

1. **Create `.env` with `ltlab configure`** before the first `npm run start:prod`
2. **Monitor resource usage** during long tests
3. **Use development mode for day-to-day work** - the `ltlab` commands work with `docker-compose.yml`
4. **Check logs regularly** when running long soak tests
5. **Clean up after tests** - `npm run stop:prod` to free resources

---

**Maintained by:** David Estevez
