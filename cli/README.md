# Load Testing Lab CLI

Professional command-line interface for managing the Load Testing Lab. Execute k6 and Artillery load tests with ease, manage your testing infrastructure, and monitor results—all from a single, powerful CLI.

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

The CLI is part of the Load Testing Lab project (located in the `cli/` folder). No separate installation required.

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
# First time setup: create global link
npm link

# 1. Configure your environment
ltlab configure

# 2. Start the lab infrastructure
ltlab start

# 3. Generate a test scenario from a blueprint
ltlab generate -e k6 -n my-first-test

# 4. Run your test
ltlab k6 -s my-first-test.js

# 5. View results in Grafana
# Open http://localhost:3000 (admin/admin123)
```

**Using npm scripts (no link required):**

```bash
# 1. Configure your environment
npm run cli -- configure

# 2. Start the lab infrastructure
npm start

# 3. Generate a test scenario from a blueprint
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
- Starts InfluxDB v2 (metrics storage)
- Starts Grafana (dashboards and visualization)
- Starts Toy API (test target)
- Prepares k6 and Artillery runners

**Usage:**
```bash
ltlab start

# Or using npm script
npm start
```

**After starting:**

- Grafana Dashboard: http://localhost:3000 (admin/admin123)
- Toy API: http://localhost:5000
- InfluxDB: http://localhost:8086

---

#### `ltlab stop`

Stop all running lab services and remove containers.

**Usage:**
```bash
ltlab stop

# Or using npm script
npm stop
```

**Note:** Metrics data stored in Docker volumes is preserved. To completely reset, use `ltlab reset`.

---

#### `ltlab configure`

Interactive wizard to create or update your `.env` file with lab configuration.

**Configures:**
- Target API URL
- InfluxDB connection (URL, token, org, bucket)
- Grafana credentials
- Default test parameters (concurrency, duration)

**Usage:**
```bash
ltlab configure
```

**Default values:**
```env
TARGET_API_URL=http://localhost:5000
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_TOKEN=admin123
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=loadtests
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin123
CONCURRENCY=50
DURATION=60s
```

---

#### `ltlab info`

Display current environment configuration and Docker container status.

**Usage:**
```bash
ltlab info
```

**Shows:**
- All environment variables from `.env`
- Running container status
- Service health

**Use when:**
- Troubleshooting configuration issues
- Verifying environment setup
- Checking service status

---

#### `ltlab reset`

Reset all metrics data in InfluxDB - deletes data from all user buckets.

**⚠️ Warning:** This action cannot be undone! All historical metrics will be deleted.

**Usage:**
```bash
ltlab reset
```

**What it does:**
- Asks for confirmation before proceeding
- Fetches all user buckets (k6, artillery, etc.)
- Deletes all data from each bucket
- Skips system buckets (starting with `_`)
- Shows progress for each bucket
- Provides summary of success/failures

**Interactive confirmation:**
The command will always ask you to confirm before deleting data, preventing accidental data loss.

**Use when:**
- Starting fresh test campaigns
- Cleaning up after experiments
- Removing corrupted or invalid data
- Preparing for new testing cycles

**Note:** Requires InfluxDB to be running (`ltlab start`)

---

#### `ltlab restart`

Restart one or more services without losing data.

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
- `grafana` - Grafana dashboards (useful after dashboard updates)
- `toy-api` - Test API
- `telegraf` - Metrics collector
- `all` - Restart all services

**Use when:**
- Applying configuration changes to Grafana
- Dashboard provisioning not updating
- Service needs quick recovery without full stop/start
- Testing service restart behavior

**Note:** This uses `docker-compose restart` which keeps containers and data intact.

---

#### `ltlab purge`

⚠️ **DANGER ZONE** - Complete lab reset with data deletion.

**What it does:**
- Stops all containers
- Removes all containers
- **Deletes all volumes (ALL DATA LOST)**
- Removes all networks
- Cleans up orphaned containers

**⚠️ Double Confirmation Required:**
1. Type "yes" to proceed
2. Enter random confirmation code (e.g., "X7KP2M")

**Usage:**
```bash
ltlab purge
```

**Use when:**
- Complete fresh start needed
- Persistent data corruption
- Switching to different lab configuration
- Cleaning up before deletion

**⚠️ CANNOT BE UNDONE - ALL DATA INCLUDING:**
- All InfluxDB metrics and buckets
- All Grafana dashboards and settings
- All configuration and logs
- All Docker volumes

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
- `-e, --engine <engine>` (required): Engine to use (`k6` or `artillery`)
- `-n, --name <name>` (required): Name for the new scenario file

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

5. **variable-traffic** - Fluctuating load patterns
   - Best for: Simulating real-world traffic patterns
   - Pattern: Load varies over time

**Output:**
- k6 scenarios: `k6/scenarios/<name>.js`
- Artillery scenarios: `artillery/scenarios/<name>.yml`

**Next steps:**
After generating, edit the scenario file to customize:
- API endpoints
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

# Built-in scenarios:
ltlab k6 -s my-test.js
ltlab k6 -s spike-load.js
ltlab k6  # Runs default: inspection-flow.js

# External local files (auto-detected):
ltlab k6 -s ./tests/my-test.js
ltlab k6 -s /absolute/path/to/test.js

# Project with helpers/imports:
ltlab k6 -p ./my-project/tests -s main.js
```

**Options:**
- `-s, --scenario <file>`: Scenario file to run
- `-p, --project <dir>`: Mount entire project directory (for scenarios with helpers/data)

**Auto-detection:**
- If file exists locally → mounts parent directory and runs it
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
# Mounts entire directory at /project, imports work correctly
```

**Results:**
- Real-time metrics in terminal
- Historical data in InfluxDB
- Dashboards in Grafana: http://localhost:3000

---

#### `ltlab artillery`

Run an Artillery load test scenario.

**Usage:**
```bash
ltlab artillery -s <scenario>
ltlab artillery -p <project-dir> -s <scenario>

# Built-in scenarios:
ltlab artillery -s my-test.yml
ltlab artillery -s steady-load.yml
ltlab artillery  # Runs default: inspection-flow.yml

# External local files:
ltlab artillery -s ./tests/load.yml

# Project with data files:
ltlab artillery -p ./my-tests -s stress.yml
```

**Options:**
- `-s, --scenario <file>`: Scenario file to run
- `-p, --project <dir>`: Mount entire project directory (for scenarios with data files)

**Results:**
- Real-time metrics in terminal (via Telegraf)
- Historical data in InfluxDB
- Dashboards in Grafana: http://localhost:3000

---

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
- `link <dir>`: Copy dashboards from external directory to `grafana/dashboards/custom/`
- `copy <dir>`: Alias for `link` (same behavior)
- `list`: List all dashboards (built-in and custom)
- `unlink`: Remove the `custom/` folder with all linked dashboards

**After linking:**
```bash
ltlab restart -s grafana
# Dashboards appear in Grafana under "custom" folder
```

**Workflow:**
- Your project folder is the **source of truth**
- The lab's `custom/` folder is ignored by git
- To sync changes from your project, run `link` again

**See also:** [External Projects Guide](../docs/EXTERNAL_PROJECTS.md)

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

**Use when:**
- You don't remember exact scenario names
- Want to quickly browse and run tests
- Prefer a guided experience

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
- `k6` - k6 with xk6-influxdb extension
- `artillery` - Artillery load testing engine
- `toy-api` - Test API server
- `all` - Rebuild all services

**What it does:**
- Uses `docker-compose build --no-cache`
- Forces fresh download of dependencies
- Rebuilds from scratch ignoring cached layers
- Ensures clean build state

**Use when:**
- Updating dependencies or base images
- Build cache is corrupted or outdated
- Testing changes to Dockerfile
- Dependency versions have changed
- Build problems that clean build might fix

**Note:** This does NOT remove data or stop running containers. Use with `ltlab restart` after rebuilding.

---

#### `ltlab scale`

Scale test runner instances for distributed load generation.

**Usage:**
```bash
ltlab scale -t <tool> -n <number>

# Examples:
ltlab scale -t k6 -n 3         # Run 3 k6 instances
ltlab scale -t artillery -n 2  # Run 2 Artillery instances
```

**Options:**
- `-t, --tool <tool>`: Tool to scale (`k6` or `artillery`)
- `-n, --number <count>`: Number of instances

**Use cases:**
- Generating higher load from multiple sources
- Distributed testing
- Simulating different geographic regions
- Bypassing single-instance limitations

**Note:** Requires Docker Compose scale support.

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
- Traffic spike (10 → 50 VUs) with simultaneous failures
- All problematic endpoints hit at once
- Shows system behavior when everything goes wrong
- Great for understanding p95/p99 metrics

**3. Resilience Chaos** 🟢
- Tests retry logic and error recovery
- Exponential backoff patterns
- Measures recovery time
- Demonstrates handling failures gracefully

**What it does:**
- Runs against toy-api (no external APIs needed!)
- Generates realistic failure patterns
- Creates metrics for dashboard testing
- Perfect for demos and tutorials

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
- 🔗 Connection information (URL, org, token)
- 📈 Quick links to Grafana and InfluxDB UI
- 💡 Helpful tips for viewing detailed metrics

**Output includes:**
- Bucket names and IDs
- Retention policies
- Connection configuration
- Direct links to visualization tools

**Use when:**
- Checking if InfluxDB is running and accessible
- Verifying buckets exist before running tests
- Troubleshooting metrics collection
- Getting quick connection info

**Better alternative:** Use Grafana dashboards for comprehensive visualization and querying: http://localhost:3000

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
# In your CI/CD pipeline
ltlab start
ltlab k6 -s production-smoke-test.js || exit 1
ltlab stop
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

| Blueprint          | Best For            | Load Pattern              |
|--------------------|---------------------|---------------------------|
| steady-load        | Baseline testing    | Constant VUs              |
| ramp-up-down       | Capacity planning   | Gradual increase/decrease |
| spike-load         | Elasticity testing  | Sudden bursts             |
| endpoint-thinktime | User simulation     | Realistic delays          |
| variable-traffic   | Real-world patterns | Fluctuating load          |

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
  target: "http://localhost:5000"
  phases:
    - duration: 60      # Test duration (seconds)
      arrivalRate: 10   # Requests per second
      
scenarios:
  - name: "My Scenario"
    flow:
      - get:
          url: "/api/endpoint"
```

---

## Configuration

### Environment Variables

Configured via `ltlab configure` or manually in `.env`:

| Variable           | Description             | Default                 |
|--------------------|-------------------------|-------------------------|
| `TARGET_API_URL`   | API under test          | `http://localhost:5000` |
| `INFLUXDB_URL`     | InfluxDB endpoint       | `http://influxdb:8086`  |
| `INFLUXDB_TOKEN`   | InfluxDB auth token     | `admin123`              |
| `INFLUXDB_ORG`     | InfluxDB organization   | `myorg`                 |
| `INFLUXDB_BUCKET`  | Metrics bucket          | `loadtests`             |
| `GRAFANA_USER`     | Grafana username        | `admin`                 |
| `GRAFANA_PASSWORD` | Grafana password        | `admin123`              |
| `CONCURRENCY`      | Default VUs/concurrency | `50`                    |
| `DURATION`         | Default test duration   | `60s`                   |

### Testing External APIs

To test an external API instead of the Toy API:

```bash
ltlab configure
# When prompted, enter your external API URL:
# API URL to test: https://api.example.com
```

Or manually edit `.env`:
```env
TARGET_API_URL=https://api.example.com
```

---

## Troubleshooting

### Lab won't start

**Problem:** `ltlab start` fails or containers don't start.

**Solutions:**
```bash
# Check Docker is running
docker ps

# Check for port conflicts (3000, 5000, 8086)
lsof -i :3000
lsof -i :5000
lsof -i :8086

# View Docker Compose logs
docker-compose logs

# Force recreate containers
docker-compose down
ltlab start
```

### Scenarios not found

**Problem:** `ltlab k6 -s my-test.js` says "file not found".

**Solution:**
```bash
# Verify scenario exists
ls k6/scenarios/

# Generate if missing
ltlab generate -e k6 -n my-test

# Use exact filename
ltlab k6 -s my-test.js  # Include .js extension
```

### No metrics in Grafana

**Problem:** Tests run but no data appears in dashboards.

**Solutions:**
```bash
# 1. Verify InfluxDB is running
ltlab info

# 2. Check InfluxDB token configuration
ltlab configure  # Reconfigure if needed

# 3. Verify data is being written
ltlab metrics

# 4. For k6: Check k6 output format is configured correctly
# Edit docker-compose.yml and verify xk6-influxdb output

# 5. For Artillery: Check Telegraf is running
docker-compose logs telegraf
```

### Can't access Grafana

**Problem:** http://localhost:3000 doesn't load.

**Solutions:**
```bash
# Check if Grafana container is running
docker-compose ps grafana

# Check Grafana logs
docker-compose logs grafana

# Restart Grafana
ltlab restart -s grafana
# Or manually: docker-compose restart grafana

# Check port isn't in use by another service
lsof -i :3000
```

### Permission errors

**Problem:** CLI commands fail with permission errors.

**Solutions:**
```bash
# Make CLI executable
chmod +x cli/index.js

# If using global install, use sudo (macOS/Linux)
sudo npm install -g .

# Or use npx
npx ltlab start
```

### Environment variables not loading

**Problem:** Test runs with wrong configuration.

**Solutions:**
```bash
# Verify .env exists
ls -la .env

# Check .env contents
ltlab info

# Reconfigure
ltlab configure

# Manually verify in scenario files
# k6 uses: __ENV.TARGET_API_URL
# Artillery uses config.target from yml
```

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

### Example 5: Distributed Load Generation

```bash
# Scale k6 to 3 instances for higher load
ltlab scale -t k6 -n 3

# Run test
ltlab k6 -s high-volume-test.js

# Scale back down
ltlab scale -t k6 -n 1
```

### Example 6: Daily Regression Suite

Create a script `run-regression.sh`:

```bash
#!/bin/bash
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
- **Blog Series:** [https://destbreso.com](https://destbreso.com)
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
