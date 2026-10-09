# Guide: Artillery Metrics in InfluxDB v2

Artillery has no InfluxDB v2 output of its own. In the lab, Artillery's built-in **publish-metrics** plugin sends its metrics over StatsD to **Telegraf**, and Telegraf writes them to **InfluxDB v2**, where the Artillery dashboards read them:

**Artillery** (publish-metrics) → (StatsD, UDP 8125) → **Telegraf** → **InfluxDB v2** → **Grafana**

### Current Status

✅ **Telegraf** runs as a lab service (`docker-compose.yml`, UDP port 8125), configured by `telegraf/telegraf.conf`  
✅ **Artillery image** installs `artillery@2.0.34`; publish-metrics is bundled with Artillery, so there is no separate plugin to install  
✅ **Every built-in scenario and blueprint** has the publish-metrics block  
✅ **Three Artillery dashboards** are provisioned: `artillery-telegraf`, `artillery-pro`, `artillery-elite`  
✅ **Totals match Artillery's summary**: counters such as requests and status codes reach InfluxDB exactly

### Quick Usage

```bash
# 1. Start the lab (Telegraf included); returns when every service is ready
ltlab start

# 2. Run an Artillery scenario
ltlab artillery -s toy-fast.yml

# 3. Open the dashboard "Artillery + Telegraf - War Room"
open http://localhost:3000/d/artillery-telegraf
```

The same steps with Docker Compose, from the lab's root directory:

```bash
docker compose up -d --wait
docker compose run --rm artillery run /artillery/scenarios/toy-fast.yml
```

---

## Implemented Architecture

### Data Flow

```
Artillery test (publish-metrics plugin, type statsd, prefix "artillery.")
    ↓ StatsD over UDP, telegraf:8125
Telegraf (inputs.statsd, collected every second, templates turn names into measurements and fields)
    ↓ InfluxDB v2 write API, flushed every 10 seconds
InfluxDB v2 (bucket from INFLUXDB_BUCKET, default loadtests)
    ↓ Flux queries
Grafana (Artillery dashboards)
```

### Components

1. **Artillery + publish-metrics**: reports its metrics every 10 seconds and sends them over StatsD
2. **Telegraf**: receives StatsD, names the measurements and fields, and writes to InfluxDB v2
3. **InfluxDB v2**: stores the time series
4. **Grafana**: reads them with Flux queries

---

## Step 1: Artillery Sends Its Metrics

Each scenario turns the plugin on in its `config`:

```yaml
config:
  target: "{{ $processEnvironment.TARGET_API_URL }}"
  phases:
    - duration: 30
      arrivalRate: 50
  plugins:
    publish-metrics:
      - type: statsd
        host: "{{ $processEnvironment.STATSD_HOST }}"
        port: "{{ $processEnvironment.STATSD_PORT }}"
        prefix: "artillery."
```

`STATSD_HOST=telegraf` and `STATSD_PORT=8125` are set on the `artillery` service in `docker-compose.yml`, and every built-in scenario and blueprint, the chaos scenarios included, reads them this way.

Every 10 seconds Artillery reports the period that just ended, and the plugin sends:

- **Counters** as StatsD counters: `http.requests`, `http.responses`, `http.downloaded_bytes`, `http.codes.<status>`, `vusers.created`, `vusers.completed`, `vusers.failed`, `vusers.created_by_name.<scenario>`, `errors.<code>`
- **Rates** as gauges: `http.request_rate`
- **Summaries** as one gauge per statistic (`min`, `max`, `mean`, `median`, `p50`, `p75`, `p90`, `p95`, `p99`, `p999`, `count`): `http.response_time`, its split by status class (`http.response_time.2xx`, `.4xx`, `.5xx`), and `vusers.session_length`

Every name carries the prefix `artillery.`, which Telegraf's templates and the dashboards expect. Before Artillery exits, the plugin flushes what it has not sent yet, so the last period of the run (usually a partial one) arrives too.

### Scenario names without spaces

A scenario's name becomes part of a metric name (`vusers.created_by_name.<name>`), and StatsD cuts a name at its first space. Give scenarios names without spaces; the lab's own use kebab-case (`mixed-chaos-scenario`, `error-resilience`, `everything-goes-wrong`, `rapid-fire-chaos`, `retry-logic-testing`, `mixed-reliability`).

---

## Step 2: Telegraf Receives StatsD and Writes to InfluxDB

The StatsD input in `telegraf/telegraf.conf` (excerpt, without its comments):

```toml
[[inputs.statsd]]
  interval = "1s"
  protocol = "udp"
  service_address = ":8125"
  delete_gauges = true
  delete_counters = true
  delete_sets = true
  delete_timings = true
  metric_separator = "_"
  allowed_pending_messages = 10000

  namedrop = ["artillery_plugins"]

  templates = [
    "artillery.http.response_time.*.* measurement.measurement.measurement.class.field",
    "artillery.http.response_time.* measurement.measurement.measurement.field",
    "artillery.vusers.session_length.* measurement.measurement.measurement.field",
    "artillery.http.codes.* measurement.measurement.measurement.field",
    "artillery.vusers.created_by_name.* measurement.measurement.measurement.field*",
    "artillery.errors.* measurement.measurement.field*",
    "artillery.plugins.* measurement.measurement.field*",
    "artillery.* measurement.field*"
  ]
```

What each setting does:

- **`interval = "1s"`**: the agent collects every 10 seconds, but the StatsD input collects every second. Artillery reports every 10 seconds, so each report lands in its own collection. Gauges keep only the last value of a collection, so two reports inside one collection would keep only the second.
- **`delete_* = true`**: every collection starts from zero, so a row holds only what arrived during that second. Counter increments that arrive within the same second are added together.
- **`templates`**: they decide which parts of a name form the measurement, the field and the `class` tag; parts are joined with `_` (`metric_separator`). `artillery.http.response_time.p95` becomes field `p95` of measurement `artillery_http_response_time`; `artillery.http.response_time.2xx.p95` becomes the same field with the tag `class=2xx`; `artillery.http.requests` becomes field `http_requests` of measurement `artillery`.
- **`namedrop = ["artillery_plugins"]`**: Artillery enables its metrics-by-endpoint plugin by default and reports per-endpoint metrics under `plugins.`, one series per URL and without bound for URLs that carry IDs, so they are not stored. The `expect` plugin's counters live there too.

The output writes to `http://influxdb:8086`, the address the compose file gives Telegraf, with the token, organization and bucket that Compose passes from `.env` (`INFLUXDB_TOKEN`, `INFLUXDB_ORG`, `INFLUXDB_BUCKET`), and flushes every 10 seconds (`flush_interval`).

---

## Resulting Schema

| Measurement                        | Fields                                                                                                                                             | Notes                                                                                    |
|------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| `artillery`                        | Counters `http_requests`, `http_responses`, `http_downloaded_bytes`, `vusers_created`, `vusers_completed`, `vusers_failed`; gauge `http_request_rate` | Request and virtual user counts per report                                               |
| `artillery_http_codes`             | One counter field per status code: `"200"`, `"404"`, `"500"`, ...                                                                                  | Responses per status code                                                                |
| `artillery_http_response_time`     | `min`, `max`, `mean`, `median`, `p50`, `p75`, `p90`, `p95`, `p99`, `p999`, `count`                                                                 | One row per 10-second period. The overall series has no `class` tag; series tagged `class=2xx`, `4xx` or `5xx` cover one status class |
| `artillery_vusers_session_length`  | Same statistics                                                                                                                                    | How long virtual users took to finish their scenario                                     |
| `artillery_vusers_created_by_name` | One counter field per scenario name                                                                                                                | Virtual users started per scenario; an unnamed scenario appears as its position (`0`, `1`, ...) |
| `artillery_errors`                 | One counter field per error code                                                                                                                   | Present only when Artillery reported errors                                              |

Every row also has the tags `metric_type` (`counter` or `gauge`) and `host=telegraf`.

### Why the totals are exact

Artillery sends each period's counts as StatsD counters, Telegraf adds what arrives within a second and starts again from zero, and nothing is overwritten. Summing a counter field over a time range therefore gives the exact total: the sum of `http_requests` equals `http.requests` in Artillery's end-of-test summary, and the sums in `artillery_http_codes` equal its `http.codes.*` lines.

### Why percentiles are per period

Artillery sends percentiles already computed for each 10-second period. Percentiles of different periods cannot be added or averaged into a percentile of the whole run, so the dashboards chart each period's value over time, and their stats titled **"pXX, worst report"** show the highest value among the periods in the selected range. That value is an upper bound on the run's percentile. The exact percentile for the whole run is in Artillery's end-of-test summary.

### Why the last period arrives, and when

The plugin flushes before Artillery exits, so the final report reaches Telegraf; Telegraf, which keeps running, collects it within a second and writes it at its next flush. Artillery reports every 10 seconds and Telegraf flushes every 10 seconds, so Artillery panels trail the run by up to about 20 seconds.

---

## Example Flux Queries

### In Grafana

The lab's InfluxDB datasource sets `v.defaultBucket` from `INFLUXDB_BUCKET`, so panels never name the bucket.

Total requests in the selected time range:

```flux
from(bucket: v.defaultBucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "artillery" and r["_field"] == "http_requests")
  |> group()
  |> sum()
```

Requests per second, counted per window and divided by the window length (set the panel's **Min interval** to `10s`, as the lab's panels do, so a window is never shorter than Artillery's report period):

```flux
from(bucket: v.defaultBucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "artillery" and r["_field"] == "http_requests")
  |> group()
  |> aggregateWindow(every: v.windowPeriod, fn: sum, createEmpty: false)
  |> map(fn: (r) => ({ r with _value: float(v: r._value) / (float(v: int(v: v.windowPeriod)) / 1000000000.0) }))
```

p95 of each 10-second period, all requests (the overall series has no `class` tag):

```flux
from(bucket: v.defaultBucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "artillery_http_response_time" and r["_field"] == "p95" and not exists r.class)
  |> group()
  |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)
```

p95 of the 5xx responses only:

```flux
from(bucket: v.defaultBucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "artillery_http_response_time" and r["_field"] == "p95" and r["class"] == "5xx")
  |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)
```

Share of 2xx responses among all responses, as the "Success Rate" stats compute it:

```flux
from(bucket: v.defaultBucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "artillery_http_codes")
  |> group()
  |> reduce(identity: {ok: 0.0, all: 0.0}, fn: (r, accumulator) => ({ok: accumulator.ok + (if r._field =~ /^2/ then float(v: r._value) else 0.0), all: accumulator.all + float(v: r._value)}))
  |> map(fn: (r) => ({_value: if r.all > 0.0 then r.ok / r.all * 100.0 else 0.0}))
```

### In the InfluxDB UI

In the InfluxDB UI (http://localhost:8086, **Data Explorer** > **Script Editor**), write the bucket's name: `loadtests` unless you changed `INFLUXDB_BUCKET`.

Responses per status code in the last 15 minutes:

```flux
from(bucket: "loadtests")
  |> range(start: -15m)
  |> filter(fn: (r) => r["_measurement"] == "artillery_http_codes")
  |> group(columns: ["_field"])
  |> sum()
```

Virtual users started per scenario in the last 15 minutes:

```flux
from(bucket: "loadtests")
  |> range(start: -15m)
  |> filter(fn: (r) => r["_measurement"] == "artillery_vusers_created_by_name")
  |> group(columns: ["_field"])
  |> sum()
```

Every measurement in the bucket:

```flux
import "influxdata/influxdb/schema"

schema.measurements(bucket: "loadtests")
```

### Checking a run against Artillery's summary

1. Run `ltlab artillery -s toy-fast.yml` and note `http.requests` in the summary it prints at the end
2. Wait about 20 seconds for the last report to reach InfluxDB
3. Sum `http_requests` over a range that covers the run (the "Total Requests" stat, or the first query above): the two numbers are the same

---

## Your Own Artillery Scenarios

For a scenario of your own (inside the lab or in your project, see [EXTERNAL_PROJECTS.md](EXTERNAL_PROJECTS.md)) to show up in the dashboards:

- Keep the `publish-metrics` block above in its `config`, with `prefix: "artillery."`
- Give its scenarios names without spaces
- To have `ensure` thresholds checked, list `ensure: {}` under `plugins`, as `toy-fast.yml` does; Artillery then prints the checks under `Checks:` and exits with code 1 when one is missed
- To have `expect` blocks checked, list `expect` under `plugins`, as the chaos scenarios do; a failed expectation is printed and makes Artillery exit with code 21

---

## References

**Related Resources:**
- [Blog: Quickstart Guide](https://destbreso.com/blog/load-testing-lab-getting-started) - Extended setup with k6 and Artillery
- [Blog: Common Scenarios](https://destbreso.com/blog/modeling-real-traffic-for-load-tests) - Practical Artillery examples
- [USAGE.md](USAGE.md) - Complete usage guide with Artillery commands
- [DASHBOARDS.md](DASHBOARDS.md) - The six dashboards and what each panel computes

**External documentation:**
- [Artillery publish-metrics plugin](https://www.artillery.io/docs/reference/extensions/publish-metrics)
- [Telegraf StatsD input](https://github.com/influxdata/telegraf/tree/master/plugins/inputs/statsd)
- [Telegraf InfluxDB v2 output](https://docs.influxdata.com/telegraf/v1.28/plugins/outputs/influxdb_v2/)
