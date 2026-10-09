# Load Testing Lab CLI

Professional command-line interface for managing the Load Testing Lab. Execute k6 and Artillery load tests with ease, manage your testing infrastructure, and monitor results, all from a single, powerful CLI.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands Reference](#commands-reference)
  - [Core Commands](#core-commands)
  - [Scenario Management](#scenario-management)
  - [Test Execution](#test-execution)
  - [Dashboard Management](#dashboard-management)
  - [Advanced Commands](#advanced-commands)
- [External Projects](#external-projects)
- [Workflows](#workflows)
- [Blueprint System](#blueprint-system)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## Installation

The CLI is part of the Load Testing Lab project (located in the `cli/` folder). No separate installation required: it needs Node.js 22.13 or later, Docker with Docker Compose v2, and its dependencies, installed once from the project root:

```bash
npm install
```

### Using the CLI

You have three options to use the CLI:

#### 1. Direct Execution (Recommended for Project Use)

Use npm scripts from the project root:

```bash
npm run cli -- <command> [options]

# Examples:
npm run cli -- start
npm run cli -- generate -e k6 -n my-test
npm run cli -- k6 -s my-test.js
```

Or use predefined npm shortcuts:

```bash
npm start          # Same as: npm run cli -- start
npm stop           # Same as: npm run cli -- stop
npm run configure  # Same as: npm run cli -- configure
```

#### 2. Global Link (Recommended for System-Wide Use)

Create a global symlink to use `ltlab` command anywhere:

```bash
# From the project root
npm link

# Now use ltlab globally
ltlab --help
ltlab start
ltlab generate -e k6 -n my-test
```

Every command works from any directory: Docker Compose always runs from the lab's folder, and the CLI reads the lab's own `.env`, never the `.env` of the directory you run it from.

**To remove the global link:**

```bash
npm unlink -g
```

#### 3. Node Direct Execution

Execute the CLI script directly with Node.js:

```bash
node cli/index.js <command> [options]

# Examples:
node cli/index.js start
node cli/index.js --help
```

## Quick Start

Get started with the Load Testing Lab in 5 steps:

**Using npm link (global command):**

```bash
# First time setup: install dependencies and create global link
npm install && npm link

# 1. Configure your environment (creates the lab's .env and the InfluxDB token)
ltlab configure

# 2. Start the lab infrastructure (returns once every service is ready)
ltlab start

# 3. Generate a test scenario from a blueprint, then edit its endpoints
ltlab generate -e k6 -n my-first-test

# 4. Run your test
ltlab k6 -s my-first-test.js

# 5. View results in Grafana
# Open http://localhost:3000 (admin/admin123)
```

**Using npm scripts (no link required):**

```bash
# 0. Install dependencies
npm install

# 1. Configure your environment
npm run cli -- configure

# 2. Start the lab infrastructure
npm start

# 3. Generate a test scenario from a blueprint, then edit its endpoints
npm run cli -- generate -e k6 -n my-first-test

# 4. Run your test
npm run cli -- k6 -s my-first-test.js

# 5. View results in Grafana
# Open http://localhost:3000 (admin/admin123)
```

## Commands Reference

### Core Commands

#### `ltlab start`

Start the Load Testing Lab infrastructure using Docker Compose.

**What it does:**
- Checks that the lab's `.env` exists and holds `INFLUXDB_TOKEN`; otherwise it stops and asks you to run `ltlab configure`
- Builds the k6 and Artillery images (a few minutes the first time, cached afterwards)
- Starts InfluxDB v2 (metrics storage), Telegraf (metrics collector for Artillery), Grafana (dashboards and visualization) and the Toy API (test target)
- Waits until every service is ready (`docker compose up -d --wait`, with health checks), then prints the URLs, the commands to run a test and the names of the built-in scenarios

The k6 and Artillery containers start only when a test runs (Compose profile `runners`).

**Usage:**
```bash
ltlab start

# Or using npm script
npm start
```

**After starting:**

- Grafana Dashboard: http://localhost:3000 (admin/admin123)
- Toy API: http://localhost:5000
- InfluxDB: http://localhost:8086 (admin/admin123)

`GRAFANA_PORT`, `TOY_API_PORT` and `INFLUXDB_PORT_EXPORT` in `.env` change these ports.

---

#### `ltlab stop`

Stop all running lab services and remove containers (`docker compose down --remove-orphans`).

**Usage:**
```bash
ltlab stop

# Or using npm script
npm stop
```

**Note:** Metrics and InfluxDB's setup (organization, bucket, token) stay on the `influxdb-data` volume. To delete the metrics, use `ltlab reset`; to delete the volume as well, `ltlab purge`.

---

#### `ltlab configure`

Interactive wizard to create or update the lab's `.env` file, wherever you run it from.

**Configures:**
- Target API URL, as the containers see it
- InfluxDB setup (organization, bucket, admin user and password)
- Grafana credentials
- Default test parameters (concurrency, duration) of `toy-fast.js`

**What it does:**
- Offers the value already in `.env` (or the default) for each setting
- Keeps any other key already in `.env`, such as the ports, or an `INFLUXDB_URL` for an InfluxDB that runs elsewhere (a local one, `http://localhost:<port>` or `http://influxdb:8086`, is dropped)
- Generates `INFLUXDB_TOKEN` (64 hex characters) when `.env` has none, and keeps an existing one. InfluxDB adopts this token as its admin token on its first start, and k6, Telegraf and Grafana read the same value
- Creates the file readable only by you (mode 0600)

**Usage:**
```bash
ltlab configure
```

**Default values:**
```env
TARGET_API_URL=http://toy-api:5000
INFLUXDB_TOKEN=<generated, 64 hex characters>
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=loadtests
INFLUXDB_USER=admin
INFLUXDB_PASSWORD=admin123
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin123
CONCURRENCY=50
DURATION=60s
```

Running services pick up a change with `ltlab restart -s all`. InfluxDB applies its own settings (token, organization, bucket, user, password) only on its first start: see [Configuration](#configuration).

---

#### `ltlab info`

Display the lab's configuration and the state of its services.

**Usage:**
```bash
ltlab info
```

**Shows:**
- The lab's `.env` and its path, with the token and the Grafana password masked
- The InfluxDB address in effect
- Each service's state, with its health (`healthy`, `starting`, `unhealthy`)
- Links to Grafana, InfluxDB and the toy API, with the configured ports

**Use when:**
- Troubleshooting configuration issues
- Verifying environment setup
- Checking service status

---

#### `ltlab reset`

Reset all metrics data in InfluxDB: deletes the data in every bucket except InfluxDB's system buckets.

**⚠️ Warning:** This action cannot be undone! All historical metrics will be deleted.

**Usage:**
```bash
ltlab reset
```

**What it does:**
- Asks for confirmation before proceeding
- Fetches the buckets (the lab creates one: `INFLUXDB_BUCKET`, `loadtests` by default)
- Deletes all data from each bucket
- Skips system buckets (starting with `_`)
- Shows progress for each bucket
- Provides summary of success/failures

InfluxDB's setup (organization, bucket, token) stays; only the data goes.

**Interactive confirmation:**
The command will always ask you to confirm before deleting data, preventing accidental data loss. `scripts/reset-metrics.sh` does the same without the prompt.

**Use when:**
- Starting fresh test campaigns
- Cleaning up after experiments
- Removing corrupted or invalid data
- Preparing for new testing cycles

**Note:** Requires InfluxDB to be running (`ltlab start`)

---

#### `ltlab restart`

Recreate one or all services so they start with the current `.env`, and wait until they are ready. Metrics stay on their volume.

**Usage:**
```bash
ltlab restart                    # Interactive - select service
ltlab restart -s grafana         # Restart specific service
ltlab restart -s all             # Restart all services
```

**Options:**
- `-s, --service <service>`: Service to restart (`influxdb`, `grafana`, `toy-api`, `telegraf`, or `all`)

**Available Services:**
- `influxdb` - InfluxDB database
- `grafana` - Grafana dashboards
- `toy-api` - Test API
- `telegraf` - Metrics collector
- `all` - Restart all services

**Use when:**
- Applying a change to `.env` (InfluxDB itself applies its settings only on its first start)
- Clearing the toy API's in-memory job queue
- Service needs quick recovery without full stop/start

**Note:** This runs `docker compose up -d --force-recreate --wait` (with `--no-deps` and the service name for a single service), so the containers are recreated with the current `.env`. A dashboard edited in Grafana's UI and not exported to its JSON file is lost.

---

#### `ltlab purge`

⚠️ **DANGER ZONE** - Complete lab reset with data deletion.

**What it does:**
- Stops all containers, the k6 and Artillery runners included
- Removes all containers
- **Deletes all volumes (ALL DATA LOST)**
- Removes all networks
- Cleans up orphaned containers

It runs `docker compose --profile runners down -v --remove-orphans`.

**⚠️ Double Confirmation Required:**
1. Confirm that you want to continue
2. Enter random confirmation code (e.g., "X7KP2M")

**Usage:**
```bash
ltlab purge
```

**Use when:**
- Complete fresh start needed
- Persistent data corruption
- Applying a new InfluxDB token, organization, bucket, admin user or password from `.env` (InfluxDB reads them only when it sets itself up)
- Cleaning up before deletion

**⚠️ CANNOT BE UNDONE - ALL DATA INCLUDING:**
- All InfluxDB metrics and buckets
- InfluxDB's setup (organization, admin user, token): the next `ltlab start` sets it up again from `.env`, with the same token
- All Docker volumes of the lab

It keeps `.env`, your scenarios, the dashboard JSON files and the images. Grafana keeps no state of its own, so its dashboards come back from their files on the next start.

---

### Scenario Management

#### `ltlab generate`

Generate a new test scenario from predefined blueprints.

**Usage:**
```bash
ltlab generate -e <engine> -n <name>

# Examples:
ltlab generate -e k6 -n spike-api-test
ltlab generate -e artillery -n steady-flow
```

**Options:**
- `-e, --engine <engine>`: Engine to use (`k6` or `artillery`); asked for when omitted
- `-n, --name <name>`: Name for the new scenario file; asked for when omitted

The blueprint is always picked from a list.

**Available Blueprints:**

1. **steady-load** - Constant load over time
   - Best for: Baseline performance testing
   - Pattern: Maintains consistent VUs/requests

2. **ramp-up-down** - Gradual increase and decrease
   - Best for: Capacity planning, finding breaking points
   - Pattern: Gradually increases load, then decreases

3. **spike-load** - Sudden traffic spikes
   - Best for: Testing elasticity, auto-scaling
   - Pattern: Sudden bursts of high load

4. **endpoint-thinktime** - Realistic user behavior with delays
   - Best for: Simulating real user journeys
   - Pattern: Requests with realistic delays between actions

5. **variable-traffic** - Arrival rate that rises and falls
   - Best for: Simulating real-world traffic patterns
   - Pattern: Over ten minutes, arrivals go from 5 to 20 per second, hold, peak at 40, and fall back to 5; they keep coming whether or not the API keeps up

**Output:**
- k6 scenarios: `k6/scenarios/<name>.js`
- Artillery scenarios: `artillery/scenarios/<name>.yml`

The file goes to the lab's folders wherever you run the command from, and an existing file is never overwritten.

**Next steps:**
After generating, edit the scenario file to customize:
- API endpoints (the blueprints use placeholders such as `/api/health`, which the toy API does not have)
- Load parameters
- Test duration
- Custom logic

---

### Test Execution

#### `ltlab k6`

Run a k6 load test scenario.

**Usage:**
```bash
ltlab k6 -s <scenario>
ltlab k6 -p <project-dir> -s <scenario>
ltlab k6 -s <scenario> -e KEY=value -e KEY

# Built-in scenarios:
ltlab k6 -s toy-fast.js
ltlab k6 -s toy-stress.js
ltlab k6  # Runs default: toy-fast.js

# External local files (auto-detected):
ltlab k6 -s ./tests/my-test.js
ltlab k6 -s /absolute/path/to/test.js

# Project with helpers/imports:
ltlab k6 -p ./my-project/tests -s main.js

# Environment variables for the run:
ltlab k6 -s ./tests/my-test.js -e API_TOKEN -e TARGET_API_URL=https://staging.example.com
```

**Options:**
- `-s, --scenario <file>`: Scenario file to run (default `toy-fast.js`)
- `-p, --project <dir>`: Mount entire project directory (for scenarios with helpers/data)
- `-e, --env <vars...>`: Extra environment variables: `KEY=value` as given, or `KEY` to take the value from your shell (so a secret stays off the command line); repeat `-e` for each variable

**Auto-detection:**
- If file exists locally (relative to the directory you run the command from) → mounts its parent directory, read-only, at `/external` and runs it
- If file doesn't exist locally → uses built-in scenario from `k6/scenarios/`

**Project mode (`-p`):**
Use when your scenario imports other files:
```bash
# Structure:
# my-tests/
#   main.js       ← imports helpers.js
#   helpers.js
#   data/users.json

ltlab k6 -p ./my-tests -s main.js
# Mounts entire directory at /project (read-only), imports work correctly
```

**Results:**
- Real-time metrics in terminal
- Historical data in InfluxDB
- Dashboards in Grafana: http://localhost:3000

**Exit code:** `ltlab k6` exits with k6's exit code: 0 when every threshold passes, 99 when one fails (it then prints "k6 test failed: at least one threshold was crossed (exit code 99)"), so it can gate a CI job.

---

#### `ltlab artillery`

Run an Artillery load test scenario.

**Usage:**
```bash
ltlab artillery -s <scenario>
ltlab artillery -p <project-dir> -s <scenario>

# Built-in scenarios:
ltlab artillery -s toy-fast.yml
ltlab artillery -s toy-mixed.yml
ltlab artillery  # Runs default: toy-fast.yml

# External local files:
ltlab artillery -s ./tests/load.yml

# Project with data files:
ltlab artillery -p ./my-tests -s stress.yml
```

**Options:**
- `-s, --scenario <file>`: Scenario file to run (default `toy-fast.yml`)
- `-p, --project <dir>`: Mount entire project directory (for scenarios with data files)
- `-e, --env <vars...>`: Extra environment variables, as for `ltlab k6`

**Metrics:** Artillery sends them through its built-in publish-metrics plugin, which the scenario declares in its `config` (the built-in scenarios and the blueprints do):

```yaml
config:
  plugins:
    publish-metrics:
      - type: statsd
        host: "{{ $processEnvironment.STATSD_HOST }}"
        port: "{{ $processEnvironment.STATSD_PORT }}"
        prefix: "artillery."
```

Keep the `artillery.` prefix, and give scenarios names without spaces (StatsD cuts a name at its first space).

**Results:**
- Artillery's report in the terminal every 10 seconds, and a summary at the end
- Historical data in InfluxDB, through Telegraf
- Dashboards in Grafana: http://localhost:3000 (Artillery panels trail the run by up to about 20 seconds)

**Exit code:** `ltlab artillery` exits with Artillery's exit code: 1 when an `ensure` check fails.

---

#### `ltlab run`

Interactive test runner - select engine and scenario through a wizard.

**Usage:**
```bash
ltlab run                          # Fully interactive
ltlab run -e k6                    # Pre-select k6
ltlab run -e artillery -s test.yml # Run specific test
```

**Options:**
- `-e, --engine <engine>`: Pre-select engine (`k6` or `artillery`)
- `-s, --scenario <file>`: Pre-select scenario file

It runs the lab's built-in scenarios (`k6/scenarios/`, `artillery/scenarios/`) and exits with the runner's exit code. Here `-e` picks the engine: to pass environment variables, use `ltlab k6` or `ltlab artillery`.

**Use when:**
- You don't remember exact scenario names
- Want to quickly browse and run tests
- Prefer a guided experience

---

### Dashboard Management

#### `ltlab dashboard`

Manage custom Grafana dashboards from external projects.

**Usage:**
```bash
# Link dashboards from your project (copies JSON files to custom/ folder)
ltlab dashboard link ~/projects/my-api/dashboards

# List current dashboards
ltlab dashboard list

# Remove custom dashboards
ltlab dashboard unlink
```

**Actions:**
- `link <dir>`: Copy the `.json` files at the top level of `<dir>` to `grafana/dashboards/custom/`, replacing the dashboards linked before
- `list`: List all dashboards (built-in and custom)
- `unlink`: Remove the `custom/` folder with all linked dashboards

**After linking:**
Grafana rescans its dashboards every 10 seconds, so no restart is needed: linked dashboards appear within 10 seconds in a folder named "custom" (the six built-in ones are in General), and unlinked ones disappear the same way.

**Workflow:**
- Your project folder is the **source of truth**
- The lab's `custom/` folder is ignored by git
- To sync changes from your project, run `link` again
- Grafana keeps no state of its own: a dashboard edited in its UI is lost at the next stop or restart, so export its JSON model to your project and run `link` again

**See also:** [External Projects Guide](../docs/EXTERNAL_PROJECTS.md)

---

### Advanced Commands

#### `ltlab rebuild`

Clean build of service images without using Docker cache.

**Usage:**
```bash
ltlab rebuild                    # Interactive - select service
ltlab rebuild -s k6              # Rebuild specific service
ltlab rebuild -s all             # Rebuild all services
```

**Options:**
- `-s, --service <service>`: Service to rebuild (`k6`, `artillery`, `toy-api`, or `all`)

**Available Services:**
- `k6` - k6 v1.8.1 with the xk6-output-influxdb v0.7.0 extension
- `artillery` - Artillery 2.0.34 load testing engine
- `toy-api` - Test API server
- `all` - Rebuild all services

**What it does:**
- Uses `docker compose build --no-cache`
- Forces fresh download of dependencies, at the versions pinned in each Dockerfile
- Rebuilds from scratch ignoring cached layers
- Ensures clean build state
- Recreates a running toy API from its new image; k6 and Artillery use their new image on their next run

**Use when:**
- Changing a pinned version in a Dockerfile
- Build cache is corrupted or outdated
- Testing changes to Dockerfile
- Build problems that clean build might fix

**Note:** This does NOT remove data.

---

#### `ltlab chaos`

🌪️ Run chaos engineering scenarios against toy-api - **perfect for tutorials and learning!**

**Usage:**
```bash
ltlab chaos                    # Interactive mode
ltlab chaos -e k6              # Pre-select k6, choose scenario
ltlab chaos -e artillery       # Pre-select Artillery, choose scenario
```

**Options:**
- `-e, --engine <engine>`: Pre-select engine (`k6` or `artillery`)

**Available Scenarios:**

**1. Basic Chaos** 🟡
- Mixed chaos with random errors, latency, and resource issues
- 30% error rate on `/error` endpoint
- Variable latency 500-2500ms on `/slow`
- CPU-intensive operations
- Perfect for learning to interpret metrics

**2. Spike Chaos** 🔴
- Traffic spike (k6: 10 → 50 VUs; Artillery: 5 → 30 new virtual users per second) with simultaneous failures
- All problematic endpoints hit at once
- Shows system behavior when everything goes wrong
- Great for understanding p95/p99 metrics

**3. Resilience Chaos** 🟢
- Tests retry logic and error recovery
- Exponential backoff patterns (k6: up to 3 attempts per call to `/error`)
- Measures the attempts each call needs (k6: the `attempts` trend, threshold avg < 1.5, and the `retries` counter)
- Demonstrates handling failures gracefully

**What it does:**
- Runs against toy-api (no external APIs needed!), whatever `TARGET_API_URL` says: it passes `TARGET_API_URL=http://toy-api:5000` to the run
- Generates realistic failure patterns
- Creates metrics for dashboard testing
- Perfect for demos and tutorials
- Exits with the runner's exit code

**What you'll learn:**
- How to interpret error rates in dashboards
- Understanding response time patterns (p50, p95, p99)
- Recovery time after failures
- How to identify bottlenecks visually
- Teaching load testing to beginners

**Scenario Files:**
- k6: `k6/scenarios/chaos-basic.js`, `chaos-spike.js`, `chaos-resilience.js`
- Artillery: `artillery/scenarios/chaos-basic.yml`, `chaos-spike.yml`, `chaos-resilience.yml`

**Use cases:**
- 📚 Teaching load testing to beginners
- 🎯 Testing dashboard configurations
- 🎓 Tutorial scenarios without real APIs
- 🧪 Understanding chaos engineering
- 📊 Practicing metric interpretation
- 👨‍🏫 Explaining testing concepts to non-technical people

**Perfect for:** Tutorials, demos, dashboard testing, and teaching load testing concepts!

---

#### `ltlab metrics`

Display InfluxDB metrics overview and bucket information.

**Usage:**
```bash
ltlab metrics
```

**What it shows:**
- ✓ InfluxDB connection status
- 📦 Available buckets (excluding system buckets)
- 🔗 Connection information (URL, org, and the first characters of the token)
- 📈 Quick links to Grafana and InfluxDB UI
- 💡 Helpful tips for viewing detailed metrics

**Output includes:**
- Bucket names and IDs
- Retention policies (the lab's bucket keeps everything: "infinite")
- Connection configuration
- Direct links to visualization tools

It reads the lab's `.env` and reaches InfluxDB at `http://localhost:<INFLUXDB_PORT_EXPORT>` (8086 by default), or at `INFLUXDB_URL` when it is set.

**Use when:**
- Checking if InfluxDB is running and accessible
- Verifying buckets exist before running tests
- Troubleshooting metrics collection
- Getting quick connection info

**Better alternative:** Use Grafana dashboards for comprehensive visualization and querying: http://localhost:3000

---

## External Projects

`ltlab k6` and `ltlab artillery` run scenarios that live outside the lab, so each project keeps its tests in its own repository:

| You pass                                                | Mounted in the container                     | Runs                       |
|---------------------------------------------------------|----------------------------------------------|----------------------------|
| `-s my-test.js` (no such file in the current directory) | Nothing: it is a built-in scenario           | `/k6/scenarios/my-test.js` |
| `-s ./tests/my-test.js` (an existing file)              | The file's folder, read-only, at `/external` | `/external/my-test.js`     |
| `-p ./tests -s main.js`                                 | The whole folder, read-only, at `/project`   | `/project/main.js`         |

- Paths are relative to the directory you run the command from.
- Built-in Artillery scenarios run from `/artillery/scenarios/`.
- `-e KEY=value` adds an environment variable to the run, and `-e KEY` takes its value from your shell, so a secret stays off the command line.
- Dashboards come from your project too: `ltlab dashboard link <dir>`.

**See also:** [External Projects Guide](../docs/EXTERNAL_PROJECTS.md)

---

## Workflows

### Complete Testing Workflow

```bash
# 1. Initial setup (one-time)
ltlab configure

# 2. Start infrastructure
ltlab start

# 3. Create multiple test scenarios
ltlab generate -e k6 -n baseline-test
ltlab generate -e k6 -n spike-test
ltlab generate -e artillery -n stress-test

# 4. Edit scenarios (customize for your API)
# Edit files in k6/scenarios/ and artillery/scenarios/

# 5. Run tests
ltlab k6 -s baseline-test.js
ltlab k6 -s spike-test.js
ltlab artillery -s stress-test.yml

# 6. Analyze results in Grafana
# Open http://localhost:3000

# 7. Clean up
ltlab reset    # Clear old metrics (optional)
ltlab stop     # Stop infrastructure
```

### Daily Testing Routine

```bash
# Quick start
ltlab start

# Run your main test suite
ltlab k6 -s daily-health-check.js
ltlab artillery -s api-regression.yml

# Check results
# Grafana: http://localhost:3000

# Stop when done
ltlab stop
```

### Exploratory Testing

```bash
ltlab start
ltlab run  # Interactive mode - browse and select tests
```

### CI/CD Integration

```bash
# In your CI/CD pipeline (ltlab configure is interactive: write the lab's .env beforehand)
ltlab start
ltlab k6 -s ./load-tests/smoke-test.js   # exits 99 when a threshold fails
status=$?
ltlab stop
exit $status
```

---

## Blueprint System

Blueprints are pre-configured templates for common load testing patterns. They provide a starting point that you customize for your specific needs.

### Using Blueprints

1. **Generate from blueprint:**
   ```bash
   ltlab generate -e k6 -n my-scenario
   ```

2. **Select a blueprint** from the interactive prompt

3. **Customize the generated file:**
   - Edit `k6/scenarios/my-scenario.js` (for k6)
   - Edit `artillery/scenarios/my-scenario.yml` (for Artillery)

### Blueprint Locations

- k6 blueprints: `cli/blueprints/k6/`
- Artillery blueprints: `cli/blueprints/artillery/`

### Available Patterns

| Blueprint          | Best For            | Load Pattern                 |
|--------------------|---------------------|------------------------------|
| steady-load        | Baseline testing    | Constant VUs                 |
| ramp-up-down       | Capacity planning   | Gradual increase/decrease    |
| spike-load         | Elasticity testing  | Sudden bursts                |
| endpoint-thinktime | User simulation     | Realistic delays             |
| variable-traffic   | Real-world patterns | Arrival rate rises and falls |

### Customizing Scenarios

After generation, customize these aspects:

**k6 scenarios (`*.js`):**
```javascript
// Change target URL
const TARGET_URL = __ENV.TARGET_API_URL || 'http://localhost:5000';

// Adjust load profile
export const options = {
  vus: 50,           // Virtual users
  duration: '5m',    // Test duration
  // ... more options
};

// Modify test logic
export default function () {
  // Your API calls here
}
```

**Artillery scenarios (`*.yml`):**
```yaml
config:
  target: "{{ $processEnvironment.TARGET_API_URL }}"
  phases:
    - duration: 60      # Test duration (seconds)
      arrivalRate: 10   # New virtual users per second
  plugins:
    publish-metrics:    # Sends the metrics to Telegraf: keep it
      - type: statsd
        host: "{{ $processEnvironment.STATSD_HOST }}"
        port: "{{ $processEnvironment.STATSD_PORT }}"
        prefix: "artillery."

scenarios:
  - name: "my-scenario"   # No spaces: StatsD cuts a name at its first space
    flow:
      - get:
          url: "/api/endpoint"
```

---

## Configuration

### Environment Variables

Configured via `ltlab configure` or manually in the lab's `.env` (at the root of the lab):

| Variable               | Description                                                       | Default                                   |
|------------------------|-------------------------------------------------------------------|-------------------------------------------|
| `TARGET_API_URL`       | API under test, as the containers see it                          | `http://toy-api:5000`                     |
| `INFLUXDB_TOKEN`       | InfluxDB admin token, shared by k6, Telegraf and Grafana          | Generated by `ltlab configure`            |
| `INFLUXDB_ORG`         | InfluxDB organization                                             | `myorg`                                   |
| `INFLUXDB_BUCKET`      | Metrics bucket                                                    | `loadtests`                               |
| `INFLUXDB_USER`        | InfluxDB admin user                                               | `admin`                                   |
| `INFLUXDB_PASSWORD`    | InfluxDB admin password (at least 8 characters)                   | `admin123`                                |
| `GRAFANA_USER`         | Grafana username                                                  | `admin`                                   |
| `GRAFANA_PASSWORD`     | Grafana password                                                  | `admin123`                                |
| `CONCURRENCY`          | Virtual users of `toy-fast.js`                                    | `50`                                      |
| `DURATION`             | Duration of `toy-fast.js`                                         | `60s`                                     |
| `GRAFANA_PORT`         | Grafana's port on your machine (optional)                         | `3000`                                    |
| `INFLUXDB_PORT_EXPORT` | InfluxDB's port on your machine (optional)                        | `8086`                                    |
| `TOY_API_PORT`         | Toy API's port on your machine (optional)                         | `5000`                                    |
| `INFLUXDB_URL`         | An InfluxDB elsewhere, for the scripts on your machine (optional) | `http://localhost:<INFLUXDB_PORT_EXPORT>` |

InfluxDB applies `INFLUXDB_TOKEN`, `INFLUXDB_ORG`, `INFLUXDB_BUCKET`, `INFLUXDB_USER` and `INFLUXDB_PASSWORD` only when it sets itself up, on its first start. To change them later, `ltlab purge` and `ltlab start` set it up again from `.env` (the stored metrics are deleted). Grafana applies its user and password on every start.

`INFLUXDB_URL` is only for the scripts that run on your machine (`ltlab reset`, `ltlab metrics`, `npm run check-influx`, `npm run tail-influx`); leave it unset for the lab's own InfluxDB, and those scripts follow `INFLUXDB_PORT_EXPORT`.

### Testing External APIs

To test an external API instead of the Toy API:

```bash
ltlab configure
# When prompted, enter your API's URL as the containers see it:
# API URL to test, as the containers see it (http://toy-api:5000 is the lab's toy API): https://api.example.com
```

Or manually edit `.env`:
```env
TARGET_API_URL=https://api.example.com
```

For an API running on your machine, use `http://host.docker.internal:<port>` (on Linux too, where the API must listen on `0.0.0.0`). For a single run, pass the URL with `-e`: `ltlab k6 -s ./tests/smoke.js -e TARGET_API_URL=https://staging.example.com`. k6 and Artillery read `.env` on every run, so no restart is needed.

---

## Troubleshooting

### Lab won't start

**Problem:** `ltlab start` fails or containers don't start.

**Solutions:**
```bash
# Check Docker is running
docker ps

# No .env, or no INFLUXDB_TOKEN in it: create it
ltlab configure

# Check for port conflicts (3000, 5000, 8086, and 8125/udp for Telegraf)
lsof -i :3000
lsof -i :5000
lsof -i :8086
lsof -i udp:8125

# View Docker Compose logs (from the lab's folder)
docker compose logs

# Stop everything and start again
ltlab stop
ltlab start
```

`ltlab start` returns only when every service is healthy; when one is not, `ltlab info` shows which. "Docker Compose v2 was not found" means the machine has no Compose v2: install Docker Desktop, or Docker Engine with the Compose plugin.

### Scenarios not found

**Problem:** `ltlab k6 -s my-test.js` fails because the scenario does not exist.

**Solution:**
```bash
# Verify scenario exists (from the lab's folder)
ls k6/scenarios/

# Generate if missing
ltlab generate -e k6 -n my-test

# Use exact filename
ltlab k6 -s my-test.js  # Include .js extension
```

A name that is not a file in your current directory is looked up among the built-in scenarios; a scenario of yours needs its path (`./tests/my-test.js`).

### No metrics in Grafana

**Problem:** Tests run but no data appears in dashboards.

**Solutions:**
```bash
# 1. Verify every service is running and healthy
ltlab info

# 2. Check the token in .env against InfluxDB (from the lab's folder)
npm run check-influx

# 3. Verify InfluxDB answers and the bucket exists
ltlab metrics

# 4. For k6: the run must print "K6 InfluxDB configured" and "output: InfluxDBv2 (http://influxdb:8086)"
ltlab k6 -s toy-fast.js

# 5. For Artillery: check Telegraf, and that the scenario declares the publish-metrics plugin
docker compose logs telegraf
```

Artillery panels trail the run by up to about 20 seconds. For a token that InfluxDB rejects (401 Unauthorized), see [Token Problems](../docs/TROUBLESHOOTING.md#token-problems).

### Can't access Grafana

**Problem:** http://localhost:3000 doesn't load.

**Solutions:**
```bash
# Check if Grafana is running and healthy
ltlab info

# Check Grafana logs (from the lab's folder)
docker compose logs grafana

# Restart Grafana
ltlab restart -s grafana

# Check port isn't in use by another service
lsof -i :3000
```

### Permission errors

**Problem:** CLI commands fail with permission errors.

**Solutions:**
```bash
# Make CLI executable
chmod +x cli/index.js

# If npm link cannot write to npm's global folder, run the CLI without the link (from the lab's folder)
npm run cli -- start
node cli/index.js start
```

### Environment variables not loading

**Problem:** Test runs with wrong configuration.

**Solutions:**
```bash
# Show the lab's .env (its path and values, token masked)
ltlab info

# Reconfigure
ltlab configure

# Manually verify in scenario files
# k6 uses: __ENV.TARGET_API_URL
# Artillery uses config.target: "{{ $processEnvironment.TARGET_API_URL }}"
```

The CLI reads the lab's own `.env` from any directory; a `.env` in your current directory is ignored. A variable exported in your shell overrides the same key in `.env` (Compose gives the shell precedence): unset it, or set the value for one run with `-e`.

---

## Examples

### Example 1: Basic Smoke Test

```bash
# Generate a simple steady-load test
ltlab generate -e k6 -n smoke-test

# Edit k6/scenarios/smoke-test.js:
# - Set low VUs (5-10)
# - Short duration (1-2 minutes)
# - Test critical endpoints only

# Run the test
ltlab k6 -s smoke-test.js
```

### Example 2: Spike Testing

```bash
# Generate spike test
ltlab generate -e k6 -n spike-test

# Edit k6/scenarios/spike-test.js:
# - Configure baseline VUs
# - Add spike stage (10x VUs for 1 minute)
# - Return to baseline

# Run and monitor in Grafana
ltlab k6 -s spike-test.js
```

### Example 3: Endurance Testing

```bash
# Generate steady-load test
ltlab generate -e artillery -n endurance-test

# Edit artillery/scenarios/endurance-test.yml:
# - Set moderate arrivalRate
# - Long duration (30+ minutes)
# - Monitor for memory leaks, degradation

# Run overnight test
ltlab artillery -s endurance-test.yml
```

### Example 4: Multi-Engine Comparison

```bash
# Test same scenario with both engines
ltlab generate -e k6 -n comparison-test
ltlab generate -e artillery -n comparison-test

# Edit both to test same endpoints with similar load

# Run k6 version
ltlab k6 -s comparison-test.js

# Reset metrics
ltlab reset

# Run Artillery version
ltlab artillery -s comparison-test.yml

# Compare results in Grafana
```

### Example 5: Authenticated API on Staging

```bash
# API_TOKEN is set in your shell: -e API_TOKEN passes its value without writing it on the command line
ltlab k6 -s ./load-tests/checkout.js \
  -e API_TOKEN \
  -e TARGET_API_URL=https://staging.example.com

# The script reads __ENV.API_TOKEN and __ENV.TARGET_API_URL
```

### Example 6: Daily Regression Suite

Create a script `run-regression.sh`:

```bash
#!/bin/bash
# set -e stops at the first failed test: ltlab exits with the runner's exit code
set -e

echo "Starting Load Testing Lab..."
ltlab start

echo "Running regression tests..."
ltlab k6 -s api-health.js
ltlab k6 -s critical-flows.js
ltlab artillery -s stress-test.yml

echo "All tests complete. Check Grafana for results:"
echo "http://localhost:3000"

# Optionally stop
# ltlab stop
```

Make executable and run:
```bash
chmod +x run-regression.sh
./run-regression.sh
```

---

## Additional Resources

- **Main Documentation:** [../README.md](../README.md)
- **Course:** [https://destbreso.com/blog/series/load-testing-lab-guide](https://destbreso.com/blog/series/load-testing-lab-guide)
- **Grafana Dashboards:** http://localhost:3000 (when lab is running)
- **k6 Documentation:** https://k6.io/docs/
- **Artillery Documentation:** https://www.artillery.io/docs

---

## Tips & Best Practices

### 1. Always Start with Small Tests
```bash
# Start small, iterate up
ltlab generate -e k6 -n baseline
# Edit to use 5 VUs, 1 minute
ltlab k6 -s baseline.js
# Gradually increase load
```

### 2. Use Descriptive Scenario Names
```bash
# Good names
ltlab generate -e k6 -n api-login-spike
ltlab generate -e k6 -n checkout-endurance

# Avoid generic names
ltlab generate -e k6 -n test1
ltlab generate -e k6 -n my-test
```

### 3. Monitor While Testing
Always have Grafana open when running tests:
```bash
# Terminal 1
ltlab k6 -s my-test.js

# Terminal 2 (or browser)
open http://localhost:3000
```

### 4. Document Your Tests
Add comments in scenario files:
```javascript
// Purpose: Test login endpoint under spike load
// Expected: < 200ms p95, no errors
// Last run: 2024-01-15
// Results: Passed
```

### 5. Version Control Your Scenarios
```bash
git add k6/scenarios/
git add artillery/scenarios/
git commit -m "Add API regression test scenarios"
```

### 6. Reset Between Major Test Campaigns
```bash
ltlab reset  # Clear old metrics
ltlab k6 -s new-campaign.js
```

---

**Need help?** Check the [Troubleshooting](#troubleshooting) section or open an issue in the project repository.
