# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### ✅ Added
- `ltlab` follows `COMPOSE_FILE` from the lab's `.env`: with `COMPOSE_FILE=docker-compose.prod.yml`, every command drives the production stack
- **`-e` option on `ltlab k6` and `ltlab artillery`**: `-e KEY=value` passes a variable as given, `-e KEY` takes its value from your shell, so a secret stays off the command line; repeat it for several variables
- **Runner exit codes**: `ltlab k6`, `ltlab artillery`, `ltlab run` and `ltlab chaos` exit with the runner's exit code (k6: 99 when a threshold fails; Artillery: 1 when an `ensure` check fails, 21 when an `expect` check fails), so they can gate a CI job
- **`cli/lib/lab.js`**: the lab's root and `.env` (`LAB_ROOT`, `ENV_PATH`, `readLabEnv()`), Docker Compose calls from the lab's root (`compose()`), and `exitCodeOf()`
- **Health checks** for InfluxDB (`influx ping`), Grafana (`/api/health`) and the toy API (`/health`); Grafana, Telegraf, k6 and Artillery wait until InfluxDB is healthy
- **`host.docker.internal`** on the k6 and Artillery containers (`extra_hosts: host.docker.internal:host-gateway`), so an API on your machine is reachable on Linux too (there it must listen on `0.0.0.0`)
- **Job expiry in the toy API**: finished jobs leave the in-memory store 10 minutes after they finish (`JOB_TTL_MS`, default 600000), so its memory stays bounded; `GET /jobs/:id` of an older finished job answers 404, and the worker's `[Worker Stats]` line counts the jobs currently in the store
- **`ensure` checks in `toy-fast.yml`** (p95 < 500, p99 < 1000, maxErrorRate 1): the same verdict as `toy-fast.js`
- **Trend `attempts` in `chaos-resilience.js`**, with the threshold `avg<1.5` (a call to `/error` needs 1.39 attempts on average)
- **`.gitignore` entries** for `docker-compose.override.yml` and `grafana/dashboards/custom/`, replacing a rule that ignored any path containing "custom"

### 🔄 Changed
- **Every command works from any directory**: Docker Compose always runs from the lab's root, and the CLI loads the lab's `.env`, never the current directory's, so a project's own `.env` does not leak into the lab
- **Docker Compose v2**: the CLI uses the `docker compose` plugin, or the standalone `docker-compose` v2 binary when that is what is installed, and rejects Compose v1 with an error; npm scripts and docs use `docker compose`
- **Node.js 22.13 or later** (`engines` in package.json)
- **The InfluxDB token lives only in `.env`**: `ltlab configure` generates `INFLUXDB_TOKEN` (64 hexadecimal characters) when there is none; on its first start InfluxDB adopts it as its admin token, and k6, Telegraf and Grafana read the same value. Grafana's datasource reads `${INFLUXDB_TOKEN}`, `${INFLUXDB_ORG}` and `${INFLUXDB_BUCKET}` from its environment; no token is committed in the repository
- **`ltlab configure`** writes the lab's `.env` (mode 0600) wherever it runs, keeps the values already there and any extra keys, and does not write `INFLUXDB_URL`: the host-side scripts reach InfluxDB at `http://localhost:<INFLUXDB_PORT_EXPORT or 8086>`, so moving the port needs no other change. A custom `INFLUXDB_URL`, for an InfluxDB somewhere else, is kept; an automatic one (`http://influxdb:8086` or a localhost address) is dropped
- **`ltlab start`** refuses to run without `.env` or `INFLUXDB_TOKEN`, builds the k6 and Artillery images, returns only when every service is ready (`up -d --wait`), and prints the URLs with the ports from `.env`, the run commands and the built-in scenario names
- **`ltlab stop`** runs `down --remove-orphans`; metrics and InfluxDB's setup stay on the `influxdb-data` volume
- **`ltlab restart`** recreates the services (`up -d --force-recreate --wait`), so a changed `.env` takes effect
- **`ltlab rebuild`** recreates a running toy API from its new image; the runners use their new image on the next run
- **`ltlab purge`** runs `--profile runners down -v --remove-orphans`; InfluxDB is set up again on the next start, with the token in `.env`
- **`ltlab chaos`** always targets the toy API (`TARGET_API_URL=http://toy-api:5000`), whatever `.env` says
- **`ltlab info`** shows the lab's `.env` (token masked to 6 characters, passwords masked), the effective InfluxDB URL, each service's state and health, and the URLs with the configured ports; **`ltlab metrics`** checks InfluxDB's health and lists the buckets with their retention, using the lab's `.env`
- **`ltlab dashboard link`** needs no Grafana restart: Grafana rescans its dashboards every 10 seconds. Linked dashboards appear in a folder named "custom", the six built-in ones in General
- **Host-side scripts** (`reset-metrics.js`, `check-influx-token.js`, `tail-influx.js`) load the lab's `.env` from their own location and reach InfluxDB at `http://localhost:<INFLUXDB_PORT_EXPORT or 8086>` unless `INFLUXDB_URL` is set; `scripts/reset-metrics.sh` wraps `reset-metrics.js`
- **Compose**: no fixed container names (containers are `<project>-<service>-1`); k6 and Artillery are in the `runners` profile, start only for a run, and mount only `./k6` and `./artillery`; `INFLUXDB_ORG` and `INFLUXDB_BUCKET` default to `myorg` and `loadtests` everywhere; Grafana is stateless (no volume, everything from provisioning, admin user and password from `.env` on every start)
- **`docker-compose.prod.yml`** is the same stack plus `restart: unless-stopped` on InfluxDB, Grafana, Telegraf and the toy API; `npm run start:prod` runs `docker compose -f docker-compose.prod.yml up -d --wait`
- **Pinned images**: k6 v1.8.1 built by xk6 v1.4.14 with xk6-output-influxdb v0.7.0 (Go 1.26 builder, `GOTOOLCHAIN=auto`) on `grafana/k6:0.49.0`; `artillery@2.0.34` on `node:22-alpine`; the toy API on `node:22-alpine`, installed with `yarn install --frozen-lockfile --production`
- **Artillery to InfluxDB**: every scenario and blueprint uses Artillery's built-in publish-metrics plugin (type `statsd`, host and port from `STATSD_HOST` and `STATSD_PORT`, prefix `artillery.`), which sends counters as StatsD counters and flushes before Artillery exits. Telegraf collects StatsD every second, and its templates produce the measurements `artillery`, `artillery_http_codes`, `artillery_http_response_time` (with a `class` tag for 2xx, 4xx and 5xx), `artillery_vusers_session_length`, `artillery_vusers_created_by_name` and `artillery_errors`; per-endpoint metrics are dropped (`namedrop = ["artillery_plugins"]`). Totals in InfluxDB equal Artillery's summary
- **Scenario names in kebab-case**, since StatsD cuts a name at its first space: `mixed-chaos-scenario`, `error-resilience`, `everything-goes-wrong`, `rapid-fire-chaos`, `retry-logic-testing`, `mixed-reliability`
- **k6 chaos scenarios**: `chaos-basic.js` tags requests with `endpoint`; `chaos-spike.js` records the Trend `pass_duration` (time for one pass through the four routes, pauses included); `chaos-resilience.js` records the Counter `retries` without a threshold
- **Blueprint variable-traffic** varies its load: the k6 version uses `ramping-arrival-rate` (from 5/s to 20 over 2m, 3m at 20, to 40 over 1m, 2m at 40, down to 5 over 2m; `preAllocatedVUs` 50, `maxVUs` 100) and the Artillery version phases with `rampTo` along the same profile; ten minutes in both
- **Dashboards**: every query reads `from(bucket: v.defaultBucket)`; all six refresh every 5 seconds; the k6 percentile panels and stats merge all series with `group()`; "Requests Per Second" panels are per-second rates; the k6 "Iterations" panels are "Iterations per second"; the three Artillery dashboards are rewritten for the new schema, with requests per second from the `http_requests` counter, latency from the overall `artillery_http_response_time` series, and percentile stats titled "pXX, worst report" (the highest value among Artillery's 10-second periods, an upper bound on the run's percentile)

### 🔧 Fixed
- `package.json` carries the version of the last release (1.2.0), so `ltlab --version` reports it
- k6 dashboards: the Test Activity stat counts each request once (it also counted the `url` field), and the bandwidth panels of `k6-pro` and `k6-elite` show bytes per second
- **`ltlab reset`**: InfluxDB 2.x rejects regular expressions in delete predicates, so the reset now deletes with no predicate
- **`ltlab k6` and `ltlab artillery` defaults**: both default to `toy-fast` (`toy-fast.js`, `toy-fast.yml`); the k6 default pointed at a scenario that no longer existed
- **`ltlab info`** printed the InfluxDB password unmasked; it is masked like the Grafana one
- **The CLI's quick start** (`ltlab --help`) ran a freshly generated blueprint, whose endpoints are placeholders, against the toy API; it runs `toy-fast.js` first and says to edit a generated scenario's endpoints
- **k6 image without the InfluxDB output**: an unpinned build produced k6 v2, which left the v1-only extension out; the pinned versions build k6 with it
- **Artillery totals**: the previous StatsD plugin sent every value as a gauge, so reports that met in one Telegraf interval overwrote each other and the final report was lost; counters and the flush on exit fix both
- **Artillery `toy-mixed.yml` and `toy-stress.yml`** used an invalid `randomSwitch`, so every virtual user failed; they are weighted scenarios with the same proportions (toy-mixed 40/20/15/15/10 fast/slow/users/cpu/error, toy-stress 30/40/30 fast/slow/cpu). **`toy-workers.yml`** had an invalid loop and did not start
- **Artillery chaos scenarios**: `chaos-basic.yml` loaded a processor file that did not exist, so it failed at startup; the `ensure` checks of `chaos-spike.yml` and `chaos-resilience.yml` and the `expect` blocks were ignored. All three run, with the expect plugin enabled (it prints only failures) and the ensure plugin wherever there are `ensure` checks
- **Artillery blueprints**: their target was the literal string `${TARGET_API_URL}`, which Artillery does not expand, and two had no metrics plugin; they read `{{ $processEnvironment.TARGET_API_URL }}` and send metrics like the built-in scenarios. `steady-load.yml`, `ramp-up-down.yml` and `spike-load.yml` declared `ensure` checks and `expect` blocks without loading the plugins, so both were ignored; the plugins are enabled, and all twelve Artillery files (scenarios and blueprints) apply their checks the same way
- **k6 `chaos-basic.js`** overwrote k6's own `scenario` tag; it uses `endpoint`
- **k6 `chaos-spike.js`**: the Trend named `recovery_time` measured one pass through the routes; it is `pass_duration`
- **k6 `chaos-resilience.js`**: the threshold `retries count<1000` failed on a normal run; it is replaced by `attempts avg<1.5`
- **k6-elite dashboard**: "Success Rate" returned nothing; "Peak VUs Utilization" joined on timestamps that never matched (now max `vus` divided by max `vus_max`, "No data" when empty); "Total Throughput" gave one value per series (now one value: bytes received plus sent)
- **Artillery dashboards**: the "Success Rate" stats showed hard-coded 99.5% and 99%, and "Scenario Success Rate" a hard-coded 98%; they are computed (share of 2xx among all status codes; completed divided by completed plus failed virtual users)
- **Toy API memory**: the job store only grew; finished jobs now expire

### 🗑️ Removed
- `scripts/add-percentile-panels.py` and `scripts/add-artillery-percentile-panels.py`, which generated panels for a metrics schema that no longer exists
- **`ltlab scale`** and the `scale:*` npm scripts, and the `copy` alias of `ltlab dashboard`
- **`scripts/generate-influx-token.js` and `npm run influx:token`**: `ltlab configure` creates the token
- **`npm run test:env`** and `test-inquirer.js`
- **The unused `artillery` dependency** of package.json (`yarn.lock` regenerated)
- **`artillery-plugin-statsd`** from the Artillery image
- **The `grafana-data` volume**, which mounted a path Grafana does not use, and the unused `./scripts` and `./custom` mounts of the runners
- **The ignored `folder` setting** in `dashboards.yaml`, **runner replicas** in `docker-compose.prod.yml`, and the **`percentiles` line** in `telegraf.conf`
- **`k6/k6.config.js`** (unused, with invalid threshold syntax) and **`influxdb/config/config.yml`** (not mounted by the compose files)
- **The `blog/` folder**: the course lives on [destbreso.com](https://destbreso.com/blog/series/load-testing-lab-guide)

### ⚠️ Upgrade Notes
- An install set up before these changes keeps working if `.env` holds the token InfluxDB knows. Otherwise, run `ltlab purge` and start again (this deletes stored metrics), or create a token in InfluxDB's UI and put it in `.env`; see [Upgrading from 1.2.0](#upgrading-from-120-to-the-unreleased-changes)
- Dashboards and queries written for the previous Artillery measurements need the new schema ([ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md))
- `ltlab scale` and `ltlab dashboard copy` no longer exist; use `ltlab dashboard link` for dashboards

### 📝 Documentation Reorganization

#### New Professional Documentation Structure
- **docs/README.md** - Master documentation hub with table of contents
- **docs/SETUP.md** - Complete installation and configuration guide
- **docs/USAGE.md** - Comprehensive guide for running tests
- **docs/DASHBOARDS.md** - Grafana dashboard guide with all 6 dashboards
- **docs/TROUBLESHOOTING.md** - Consolidated troubleshooting guide
- **docs/CONTRIBUTING.md** - Contribution guidelines and style guides
- **docs/CHANGELOG.md** - This file (version history)

#### Documentation Improvements
- Eliminated redundancy from massive 1988-line README
- Created clear separation of concerns (setup vs usage vs troubleshooting)
- Added comprehensive cross-references between documents
- Improved navigation with detailed tables of contents
- Added custom metrics examples for business KPIs
- Enhanced dashboard customization guide
- Professional formatting and consistent structure

---

## [1.2.0] - 2026-01-29

### ✅ Added - CLI Operational Commands

#### New CLI Commands
- **ltlab restart** - Interactive service restart without data loss
  - Restart individual services (influxdb, grafana, toy-api, telegraf)
  - Restart all services at once
  - Useful for applying configuration changes (especially Grafana dashboards)
  - Uses `docker-compose restart` (keeps data intact)

- **ltlab rebuild** - Clean build without Docker cache
  - Rebuild specific services (k6, artillery, toy-api)
  - Rebuild all services
  - Forces fresh dependency downloads
  - Uses `docker-compose build --no-cache`
  - Useful when dependencies or Dockerfiles change

- **ltlab purge** - Complete lab reset with safety confirmation
  - ⚠️ Deletes ALL data including volumes
  - Double confirmation required (yes/no + random code)
  - Random 6-character confirmation code (e.g., "X7KP2M")
  - Uses `docker-compose down -v --remove-orphans`
  - Complete fresh start capability

#### CLI Improvements
- **generate** and **run** commands now fully interactive
  - All parameters optional - prompts for missing values
  - Interactive selectors for engines, blueprints, and scenarios
  - Fixed inquirer v13+ compatibility (type: "select" instead of "list")

### 📝 Updated - Documentation
- **cli/README.md** - Added comprehensive documentation for 3 new commands
  - restart command with use cases and examples
  - rebuild command with clean build explanation
  - purge command with safety warnings and confirmation flow
- **README.md** - Updated troubleshooting section to reference new CLI commands
  - Grafana restart now uses `ltlab restart -s grafana`
  - k6 rebuild now uses `ltlab rebuild -s k6`
  - Added CLI examples in FAQ section

---

## [1.1.0] - 2026-01-24

### ✅ Added - Complete Artillery Integration

#### Artillery + Telegraf + StatsD Integration
- **telegraf/telegraf.conf** - Telegraf configuration with StatsD input and InfluxDB v2 output
- **Telegraf service** added to docker-compose.yml (port 8125/udp)
- **artillery-plugin-statsd** installed in Artillery Dockerfile
- Automatic StatsD configuration in all scenarios:
  - `artillery/scenarios/toy-fast.yml`
  - `artillery/scenarios/toy-mixed.yml`
  - `artillery/scenarios/toy-stress.yml`
  - `artillery/scenarios/toy-workers.yml`
  - a project-specific scenario, since removed
- Environment variables for Artillery:
  - `STATSD_HOST=telegraf`
  - `STATSD_PORT=8125`

#### Dashboards
- **grafana/dashboards/k6-dashboard.json** - Basic k6 War Room dashboard
- **grafana/dashboards/k6-elite.json** - Elite k6 dashboard with heatmaps
- **grafana/dashboards/k6-pro.json** - Professional k6 dashboard
- **grafana/dashboards/artillery-telegraf.json** - Basic Artillery + Telegraf dashboard
- **grafana/dashboards/artillery-elite.json** - Elite Artillery dashboard
- **grafana/dashboards/artillery-pro.json** - Professional Artillery dashboard
- All dashboards use Flux queries (InfluxDB v2 compatible)
- Auto-provisioned on Grafana startup

#### Documentation
- **docs/END_TO_END_TESTING_GUIDE.md** - Comprehensive E2E testing and troubleshooting guide
  - Pre-test checklists
  - Artillery complete validation procedure
  - k6 complete validation procedure
  - Verification procedures for InfluxDB and Grafana
  - Professional troubleshooting guide with solutions
  - Performance benchmarks and acceptance criteria
  - Advanced diagnostics techniques
- **scripts/e2e-test.sh** - Automated end-to-end validation script
- **scripts/test-artillery-integration.sh** - Artillery-specific integration test
- **docs/ARTILLERY_INFLUXDB_GUIDE.md** updated with "COMPLETE IMPLEMENTATION" status
- Data flow architecture: Artillery → Telegraf → InfluxDB → Grafana
- Quick usage instructions added
- **docs/ARTILLERY_IMPLEMENTATION_SUMMARY.md** - Complete technical summary

### 🔧 Fixed

- **Artillery wasn't sending metrics** - Implemented integration via Telegraf + StatsD
- **Artillery dashboards incompatible** - Replaced InfluxQL queries with Flux
- **Telegraf configuration** - Fixed precision setting and removed invalid processors
- **Documentation** - All translated to English for international accessibility

### 🔄 Changed

- **Core Components table** - Artillery now shows "Artillery + Telegraf" with ✅
- **Artillery Dashboard** - Migrated from InfluxQL to Flux queries
- **Architecture** - Added Telegraf as bridge component for Artillery
- **Testing approach** - Added automated E2E testing capabilities

---

## [1.0.0] - 2026-01-24

### ✅ Added

#### k6 + xk6-influxdb Integration
- **k6/entrypoint.sh** - Automatic script that configures environment variables for xk6-influxdb
- **k6/Dockerfile** - Custom image with pre-compiled xk6-influxdb
- Automatic `K6_OUT` configuration without modifying test scripts
- Environment variables automatically translated:
  - `INFLUXDB_ORG` → `K6_INFLUXDB_ORGANIZATION`
  - `INFLUXDB_BUCKET` → `K6_INFLUXDB_BUCKET`
  - `INFLUXDB_TOKEN` → `K6_INFLUXDB_TOKEN`
  - `K6_INFLUXDB_ADDR` = `http://influxdb:8086`

#### Documentation
- **docs/DIAGNOSIS_AND_SOLUTION.md** - Complete technical troubleshooting analysis
- **docs/ARTILLERY_INFLUXDB_GUIDE.md** - Artillery integration guide with InfluxDB v2
- **CHANGELOG.md** - This file
- FAQ section in README.md with frequently asked questions
- Technical architecture section for k6 + xk6-influxdb
- Improved Quick Start (5 minutes)
- Project status badge

#### Scripts
- **scripts/check-influx-token.js** - Verify token configuration
- **scripts/generate-influx-token.js** - Generate new InfluxDB tokens
- Configuration validation before running tests
- Confirmation messages when k6 starts with InfluxDB configured

### 🔧 Fixed

- **k6 wasn't sending data to InfluxDB** - `K6_OUT` was commented in docker-compose.yml
- **Incorrect token in Grafana** - Synchronized datasource token with `.env`
- **k6 scripts with errors** - Fixed a configuration import in a k6 scenario
- **Complex configuration** - Removed need to configure InfluxDB in each script
- **Docker Compose not expanding variables** - Solved with entrypoint.sh

### 🔄 Changed

- **README.md** updated with:
  - Current project status
  - Detailed technical architecture
  - FAQ section
  - Improved troubleshooting
  - Updated Quick Start
  - Enhanced "Why Not Just Use k6?" comparison
- **k6/scenarios/toy-fast.js** - Simplified, removed commented code
- **A k6 scenario** (since removed) - Added correct config import
- **grafana/provisioning/datasources/influxdb.yaml** - Updated token

### 📝 Documented

- Complete k6 + xk6-influxdb configuration flow
- Three solutions for integrating Artillery with InfluxDB v2
- Component status table
- Improved troubleshooting guide with 8+ common scenarios
- CI/CD usage examples

### ⚠️ Known / Pending

- **Artillery metrics integration** - Implemented via Telegraf (v1.1.0)

---

## [0.9.0] - 2026-01-20 (Pre-fix)

### Initial Functionality

- Docker Compose stack with InfluxDB, Grafana, k6, Artillery
- Toy API with multiple test endpoints
- Basic Grafana dashboards
- CLI scripts for orchestration
- Test scenarios for k6 and Artillery

### Known Issues (Fixed in 1.0.0+)

- k6 was not sending metrics to InfluxDB
- Manual configuration required in each script
- Grafana token not synchronized
- Lack of detailed technical documentation

---

## Upcoming Features

### Planned for Next Release

- [ ] **Web UI** - Dashboard for test management
- [ ] **Alerting** - Slack/Discord notifications for SLA violations
- [ ] **Distributed Testing** - Multi-instance k6 orchestration
- [ ] **Report Generation** - Automated PDF/HTML reports
- [ ] **Scheduled Tests** - Cron-based test automation

### Under Consideration

- [ ] **Multi-project Support** - Test multiple APIs from single lab
- [ ] **Cloud Deployment** - AWS/GCP deployment guides
- [ ] **WebSocket Testing** - Enhanced WebSocket scenario support
- [ ] **GraphQL Testing** - Specialized GraphQL test scenarios
- [ ] **gRPC Testing** - Support for gRPC load testing

---

## Migration Guides

### Upgrading from 1.0.0 to 1.1.0

**No breaking changes.** Artillery integration added:

```bash
# 1. Pull latest changes
git pull origin main

# 2. Rebuild services
docker compose build

# 3. Restart stack
docker compose up -d

# 4. Verify Artillery integration
ltlab artillery -s toy-fast.yml

# 5. Check new dashboards
open http://localhost:3000/d/artillery-telegraf
```

### Upgrading from 1.1.0 to 1.2.0

**No breaking changes.** New CLI commands added:

```bash
# 1. Update CLI dependencies
npm install

# 2. Try new commands
ltlab restart -s grafana
ltlab rebuild -s k6

# Note: ltlab purge requires double confirmation for safety
```

### Upgrading from 1.2.0 to the unreleased changes

**Breaking changes:** `ltlab scale` and `ltlab dashboard copy` are removed, the InfluxDB token now comes from `.env`, and the Artillery measurements have a new schema.

```bash
# 1. Pull latest changes
git pull origin main

# 2. Update CLI dependencies (Node.js 22.13 or later)
npm install

# 3. Update the lab's .env: keeps your values, adds INFLUXDB_TOKEN if it is missing
ltlab configure

# 4. Replace the running stack (start builds the k6 and Artillery images)
ltlab stop
ltlab start

# 5. Check that InfluxDB accepts the token in .env
npm run check-influx
```

If `npm run check-influx` reports a 401, InfluxDB was set up with another token: put that token back in `.env`, or create a token in InfluxDB's UI, write it to `INFLUXDB_TOKEN` and run `ltlab restart -s all`, or run `ltlab purge` and `ltlab start` (this deletes stored metrics).

---

## Versioning Policy

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0) - Breaking changes that require migration
- **MINOR** (1.X.0) - New features, backward compatible
- **PATCH** (1.1.X) - Bug fixes, backward compatible

### What Constitutes a Breaking Change?

- Changes to `.env` file structure that break existing configs
- Removal of CLI commands
- Changes to Grafana dashboard JSON that break imports
- Docker image changes that require manual intervention
- Database schema changes requiring data migration

---

## Release Process

1. **Version Bump** - Update version in package.json
2. **Update CHANGELOG** - Move [Unreleased] changes to new version
3. **Tag Release** - `git tag vX.Y.Z`
4. **Push Tags** - `git push origin vX.Y.Z`
5. **GitHub Release** - Create release with notes
6. **Documentation** - Update any version-specific docs

---

**For full documentation, see [docs/README.md](README.md)**
