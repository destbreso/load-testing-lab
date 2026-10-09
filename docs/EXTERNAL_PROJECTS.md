# 🎯 External Projects Guide

> **Use Load Testing Lab with your own projects** - Keep your test scenarios in your project folders, not in the lab.

This guide explains how to use Load Testing Lab to test **any project** without copying files into the lab repository.

---

## The Philosophy: Source of Truth

The lab is **infrastructure**. Your project is the **source of truth**.

```
┌─────────────────────────────────────────────────────────────────┐
│  LOAD TESTING LAB (shared infrastructure)                       │
│  • k6 + xk6-output-influxdb                                     │
│  • Artillery + Telegraf                                         │
│  • InfluxDB v2                                                  │
│  • Grafana + built-in dashboards                                │
│  • CLI tools                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ runs tests from
                              │
     ┌────────────────────────┼────────────────────────┐
     │                        │                        │
     ▼                        ▼                        ▼
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│ payment-api │        │ orders-api  │        │ user-api    │
│ └─tests/    │        │ └─tests/    │        │ └─tests/    │
│   └─load/   │        │   └─load/   │        │   └─load/   │
│     ├─*.js  │        │     ├─*.js  │        │     ├─*.js  │
│     └─dash/ │        │     └─dash/ │        │     └─dash/ │
└─────────────┘        └─────────────┘        └─────────────┘
  (source of truth)      (source of truth)     (source of truth)
```

**Why this matters:**
- **Tests live with code**: Add endpoint + test in the same PR
- **Natural ownership**: Each team owns their tests
- **Clean separation**: Improve lab → everyone benefits; improve tests → your project benefits
- **Simple onboarding**: One lab to learn, tests where you expect them

---

## Table of Contents

- [Overview](#overview)
- [Quick Reference](#quick-reference)
- [Simple Scenarios](#simple-scenarios-single-file)
- [Complex Scenarios](#complex-scenarios-multiple-files)
- [Passing Variables](#passing-variables)
- [Reaching Your API](#reaching-your-api)
- [Custom Dashboards](#custom-grafana-dashboards)
- [Real-World Examples](#real-world-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Load Testing Lab supports three ways to run tests:

| Mode | Command | Use Case |
|------|---------|----------|
| **Built-in** | `ltlab k6 -s toy-fast.js` | Learning, quick tests |
| **Local file** | `ltlab k6 -s ./my-test.js` | Simple single-file scenarios |
| **Project mount** | `ltlab k6 -p ./tests -s main.js` | Complex scenarios with imports |

The CLI automatically detects local files and mounts them into the container.

Every `ltlab` command works from any directory: it runs Docker Compose from the lab's root and reads only the lab's own `.env`. Run it from your project's directory, where relative paths like `./tests/k6` make sense.

---

## Quick Reference

```bash
# Simple: Run a local file
ltlab k6 -s ./my-test.js
ltlab artillery -s ./load-test.yml

# Complex: Mount project with helpers/data
ltlab k6 -p ./my-tests -s main.js
ltlab artillery -p ./load-tests -s stress.yml

# Variables: KEY=value as given, KEY alone takes the value from your shell
ltlab k6 -s ./my-test.js -e API_KEY -e REGION=us-east-1

# Dashboards: Link from your project (Grafana picks them up within 10 seconds)
ltlab dashboard link ./my-dashboards  # Copies to custom/
ltlab dashboard unlink                # Removes custom/
```

---

## Simple Scenarios (Single File)

For scenarios that don't import other files, just point to your local file:

```bash
# From your project directory
cd ~/projects/my-api

# Run your local k6 test
ltlab k6 -s ./tests/k6/api-test.js

# Run your local Artillery test  
ltlab artillery -s ./tests/artillery/load.yml

# Absolute paths also work
ltlab k6 -s /Users/me/projects/payment-api/tests/checkout.js
```

### How Detection Works

The CLI checks if the file exists locally:

```bash
# File exists locally → mounts parent directory
ltlab k6 -s ./tests/stress-test.js
# Output: "Mounting: /path/to/tests → /external"

# File doesn't exist locally → uses built-in scenario
ltlab k6 -s toy-fast.js
# Output: "Running k6 with built-in scenario: toy-fast.js"
```

### Example: Simple k6 Test

Create a file anywhere on your system:

```javascript
// ~/projects/my-api/tests/k6/health-check.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const res = http.get(`${__ENV.TARGET_API_URL}/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

Run it:

```bash
cd ~/projects/my-api
ltlab k6 -s ./tests/k6/health-check.js
```

A k6 scenario needs no configuration to send its metrics: the lab's k6 image sends every run's metrics to InfluxDB. `TARGET_API_URL` comes from the lab's `.env` (see [Reaching Your API](#reaching-your-api)).

### Example: Simple Artillery Test

An Artillery scenario sends its metrics to the lab only through the `publish-metrics` plugin, so keep this block in its `config`, as the lab's own scenarios do:

```yaml
# ~/projects/my-api/tests/artillery/load.yml
config:
  target: "{{ $processEnvironment.TARGET_API_URL }}"
  phases:
    - duration: 60
      arrivalRate: 10
  plugins:
    publish-metrics:
      - type: statsd
        host: "{{ $processEnvironment.STATSD_HOST }}"
        port: "{{ $processEnvironment.STATSD_PORT }}"
        prefix: "artillery."

scenarios:
  # No spaces in scenario names: StatsD cuts a name at its first space
  - name: "browse-products"
    flow:
      - get:
          url: "/products"
```

`STATSD_HOST` and `STATSD_PORT` are set for the Artillery container by the lab. See [ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md) for what reaches InfluxDB, and for enabling `ensure` and `expect` checks.

---

## Complex Scenarios (Multiple Files)

For scenarios that import helpers, data files, or other modules, use the `-p, --project` option.

### Project Structure

```
my-api/
  tests/
    k6/
      main.js           # ← main scenario
      helpers/
        auth.js         # ← authentication helper
        assertions.js   # ← custom checks
      data/
        users.json      # ← test data
      config.js         # ← environment config
```

### Main Scenario with Imports

```javascript
// tests/k6/main.js
import http from 'k6/http';
import { check } from 'k6';
import { getAuthToken } from './helpers/auth.js';
import { checkResponse } from './helpers/assertions.js';
import { config } from './config.js';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
};

export default function () {
  const token = getAuthToken();
  const res = http.get(`${config.baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  checkResponse(res);
}
```

### Running with Project Mount

```bash
# Mount the entire k6 directory
ltlab k6 -p ./tests/k6 -s main.js

# Output:
# Running k6 with project: ./tests/k6
#   Mounting: /Users/me/my-api/tests/k6 → /project
#   Scenario: main.js
```

The entire `tests/k6/` directory is mounted (read-only) at `/project` in the container, so all imports resolve correctly.

### Helper File Example

```javascript
// tests/k6/helpers/auth.js
import http from 'k6/http';

const AUTH_URL = __ENV.AUTH_URL || 'https://auth.example.com/token';

export function getAuthToken() {
  const res = http.post(AUTH_URL, {
    client_id: __ENV.CLIENT_ID,
    client_secret: __ENV.CLIENT_SECRET,
  });
  return res.json('access_token');
}

export function withAuth(request) {
  const token = getAuthToken();
  request.headers = {
    ...request.headers,
    Authorization: `Bearer ${token}`,
  };
  return request;
}
```

Pass the credentials from your shell, so they stay off the command line:

```bash
ltlab k6 -p ./tests/k6 -s main.js -e CLIENT_ID -e CLIENT_SECRET
```

### Data Files

```javascript
// tests/k6/main.js
import { SharedArray } from 'k6/data';

// Load test data from JSON file
const users = new SharedArray('users', function () {
  return JSON.parse(open('./data/users.json'));
});

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];
  // Use user data...
}
```

---

## Passing Variables

Every run receives the lab's settings: `TARGET_API_URL`, `CONCURRENCY` and `DURATION` from the lab's `.env`, plus what each runner needs to report its metrics. The CLI reads only the lab's `.env`, wherever you run it from: your project's own `.env` is never loaded, so its values do not reach the lab or your test by themselves.

Pass anything else with `-e` (repeat it for several variables):

| Form | Value in the container |
|------|------------------------|
| `-e KEY=value` | `value`, as given |
| `-e KEY` | The value of `KEY` in your shell, so a secret stays off the command line |

```bash
# A region as given, an API key from your shell
export API_KEY=...   # or set it however your shell or CI provides secrets
ltlab k6 -p ./tests/k6 -s main.js -e REGION=us-east-1 -e API_KEY

# Point one run at another API, whatever .env says
ltlab k6 -s ./tests/k6/health-check.js -e TARGET_API_URL=https://staging.example.com
```

Read them as `__ENV.KEY` in k6, and as `{{ $processEnvironment.KEY }}` in Artillery.

---

## Reaching Your API

The runners run in Docker containers, where `localhost` is the container itself. Set `TARGET_API_URL` (with `ltlab configure`, or per run with `-e TARGET_API_URL=...`) to the address the containers can reach:

| Where your API runs | `TARGET_API_URL` |
|---------------------|------------------|
| The lab's toy API | `http://toy-api:5000` |
| On your machine | `http://host.docker.internal:<port>` |
| On another server | Its URL, for example `https://staging.example.com` |

`host.docker.internal` works with Docker Desktop and on Linux too: the lab maps it to the host for the k6 and Artillery containers (`extra_hosts: host.docker.internal:host-gateway`). On Linux, your API must listen on `0.0.0.0`, not only on `127.0.0.1`, to accept those connections.

---

## Custom Grafana Dashboards

Add your own dashboards to visualize project-specific metrics.

### Linking Dashboards

The `link` command copies the dashboard JSON files at the top of your folder into the lab's `grafana/dashboards/custom/` folder, replacing the ones linked before:

```bash
# Link your dashboards (copies to grafana/dashboards/custom/)
ltlab dashboard link ~/projects/my-api/dashboards

# View in Grafana, within 10 seconds, no restart needed
open http://localhost:3000
# Dashboards appear in a folder named "custom"
```

Grafana rescans its dashboards every 10 seconds, so linked dashboards appear, change and disappear without a restart.

> **Why copy instead of symlink?** Docker containers can't follow symlinks that point outside the mounted directory. Copying ensures the dashboards are accessible inside the container.

### Source of Truth

- **Your project folder** = source of truth (tracked by your project's git)
- **Lab's `custom/` folder** = copy (ignored by the lab's git)
- **To sync changes**: Run `ltlab dashboard link <dir>` again

### Managing Dashboards

```bash
# List all dashboards (built-in + custom)
ltlab dashboard list

# Remove custom dashboards (gone from Grafana within 10 seconds)
ltlab dashboard unlink

# Re-sync from your project after changes
ltlab dashboard link ~/projects/my-api/dashboards
```

### Creating Custom Dashboards

1. **Export from Grafana UI**: 
   - Open existing dashboard
   - Settings → JSON Model → Copy
   - Save as `.json` file

2. **Create from scratch**:
   - Use Grafana UI to create dashboard
   - Export when done (Grafana keeps no state, so a dashboard saved only in the UI is lost when the lab stops or restarts)

3. **Modify built-in dashboards**:
   - Copy from `grafana/dashboards/`
   - Give the copy its own `uid` and `title` (Grafana does not load two dashboards with the same uid)
   - Modify and save in your project
   - Link with `ltlab dashboard link`

### Dashboard File Format

Each file is a dashboard's JSON model, as Grafana shows it in Settings → JSON Model:

```json
{
  "uid": "my-api-performance",
  "title": "My API Performance",
  "tags": ["my-api", "performance"],
  "timezone": "browser",
  "refresh": "5s",
  "panels": [
    // ... panel definitions
  ],
  "schemaVersion": 38,
  "version": 1
}
```

Point panels at the lab's datasource (`"datasource": {"type": "influxdb", "uid": "influxdb"}`) and read from `from(bucket: v.defaultBucket)`, as the built-in dashboards do, so they follow the lab's bucket setting.

---

## Real-World Examples

### Example 1: E-commerce API

```
ecommerce-api/
  src/
  tests/
    k6/
      scenarios/
        checkout-flow.js      # Full checkout simulation
        product-browse.js     # Product browsing load
        payment-stress.js     # Payment endpoint stress
      helpers/
        cart.js               # Cart operations
        payment.js            # Payment mocking
      data/
        products.json         # Sample products
        users.json            # Test users
    dashboards/
      ecommerce-metrics.json  # Custom dashboard
```

```bash
# Setup
cd ~/projects/ecommerce-api
ltlab dashboard link ./tests/dashboards

# Run tests
ltlab k6 -p ./tests/k6 -s scenarios/checkout-flow.js
ltlab k6 -p ./tests/k6 -s scenarios/payment-stress.js

# View results
open http://localhost:3000
```

### Example 2: Microservices Testing

```bash
# Test multiple services with the same lab instance
cd ~/projects

# Service 1: User API
ltlab k6 -s ./user-service/tests/k6/user-crud.js

# Service 2: Order API  
ltlab k6 -p ./order-service/tests -s order-flow.js

# Service 3: Notification API
ltlab artillery -s ./notification-service/tests/notification-load.yml

# All results in same Grafana, filter by tags
```

### Example 3: CI/CD Integration

```yaml
# .github/workflows/load-test.yml
name: Load Tests

on:
  push:
    branches: [main]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Load Testing Lab
        run: |
          git clone https://github.com/destbreso/load-testing-lab.git ~/ltlab
          cd ~/ltlab && npm install && npm link
          # ltlab configure asks questions; in CI, write the lab's .env directly
          printf 'TARGET_API_URL=%s\nINFLUXDB_TOKEN=%s\n' "https://staging.example.com" "$(openssl rand -hex 32)" > ~/ltlab/.env
          ltlab start

      - name: Run Load Tests
        # ltlab exits with k6's exit code: 99 when a threshold fails, which fails the job
        run: ltlab k6 -p ./tests/k6 -s smoke-test.js

      - name: Cleanup
        if: always()
        run: ltlab stop
```

---

## Best Practices

### 1. Project Structure

Keep test files organized in your project:

```
my-project/
  src/                    # Your application code
  tests/
    unit/                 # Unit tests
    integration/          # Integration tests
    load/                 # Load tests ← Keep here!
      k6/
        scenarios/
        helpers/
        data/
      artillery/
        scenarios/
      dashboards/
```

### 2. Environment Variables

Use environment variables for configuration:

```javascript
// config.js
export const config = {
  baseUrl: __ENV.TARGET_API_URL || 'http://toy-api:5000',
  apiKey: __ENV.API_KEY,
  timeout: __ENV.TIMEOUT || '30s',
};
```

```bash
# Pass variables when running: TIMEOUT as given, API_KEY from your shell
ltlab k6 -p ./tests/k6 -s main.js -e TIMEOUT=60s -e API_KEY
```

### 3. Reusable Helpers

Create shared helper modules:

```javascript
// helpers/http.js
import http from 'k6/http';
import { check } from 'k6';

export function apiRequest(method, path, body = null, headers = {}) {
  const baseUrl = __ENV.TARGET_API_URL;
  const url = `${baseUrl}${path}`;
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  
  let res;
  switch (method.toUpperCase()) {
    case 'GET':
      res = http.get(url, params);
      break;
    case 'POST':
      res = http.post(url, JSON.stringify(body), params);
      break;
    // ... other methods
  }
  
  return res;
}
```

### 4. Tagging for Filtering

Use tags to filter results in Grafana:

```javascript
export const options = {
  tags: {
    project: 'my-api',
    environment: __ENV.ENV || 'local',
    flow: 'checkout',
  },
};
```

Avoid the tag name `scenario`: k6 sets that tag itself, with the name of the running scenario.

### 5. Local Changes to the Lab

To change the lab's stack on your machine only (a port mapping, an extra variable for a service, another service), put the change in `docker-compose.override.yml` in the lab's root directory. Docker Compose merges that file with `docker-compose.yml` automatically, the `ltlab` commands included, and the lab's git ignores it. Ports have their own settings in `.env`: `GRAFANA_PORT`, `INFLUXDB_PORT_EXPORT` and `TOY_API_PORT`.

---

## Troubleshooting

### "File not found" Errors

**Problem**: k6 can't find imported files

**Solution**: Use `-p` to mount the project directory

```bash
# Wrong: Only mounts the file's directory
ltlab k6 -s ./scenarios/main.js

# Right: Mounts entire project
ltlab k6 -p ./tests/k6 -s scenarios/main.js
```

### Import Path Issues

**Problem**: Imports don't resolve correctly

**Solution**: Use relative paths from the scenario file

```javascript
// If running: ltlab k6 -p ./tests/k6 -s main.js
// main.js is at /project/main.js in container

// Correct paths:
import { helper } from './helpers/auth.js';                 // /project/helpers/auth.js
const users = JSON.parse(open('./data/users.json'));        // /project/data/users.json

// Wrong:
import { helper } from '../helpers/auth.js';     // Goes outside /project
```

### Connection Refused to an API on Your Machine

**Problem**: The test reaches nothing at `http://localhost:<port>`

**Solution**: Inside the container, `localhost` is the container itself. Use `http://host.docker.internal:<port>`, and on Linux make your API listen on `0.0.0.0` (see [Reaching Your API](#reaching-your-api)).

### A Variable From Your Project's `.env` Is Empty

**Problem**: `__ENV.MY_VAR` is undefined in the test, although your project's `.env` sets it

**Solution**: The lab never reads your project's `.env`. Pass the variable with `-e MY_VAR=value`, or export it in your shell and pass `-e MY_VAR`.

### Dashboard Not Appearing

**Problem**: Linked dashboards don't show in Grafana

**Solution**: Grafana rescans every 10 seconds; wait a moment and reload the page. If the dashboard still does not appear:

```bash
# Check the files were copied
ltlab dashboard list

# Check Grafana's provisioning log, from the lab's root directory
docker compose logs grafana | grep -i provision
```

Common causes: the file is not a dashboard's JSON model, its `uid` is already used by another dashboard, or it sits in a subfolder (`link` copies only the `.json` files at the top of the folder).

### Permission Issues

**Problem**: Can't read files in mounted directory

**Solution**: The runners do not run as your user (k6 runs as an unprivileged user), so the files must be readable by others:

```bash
# Readable by everyone, directories traversable
chmod -R a+rX ./tests/k6/

# Verify dashboards are correctly linked
ltlab dashboard list
```

---

## Next Steps

- 📊 [Dashboard Guide](DASHBOARDS.md) - Understanding built-in dashboards
- ▶️ [Usage Guide](USAGE.md) - CLI commands reference
- 🔧 [Troubleshooting](TROUBLESHOOTING.md) - Common issues
- 🤝 [Contributing](CONTRIBUTING.md) - Add new features

---

**Questions?** Open an issue or check [destbreso.com](https://destbreso.com) for tutorials.
