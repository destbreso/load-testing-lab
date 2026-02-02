# 🎯 External Projects Guide

> **Use Load Testing Lab with your own projects** - Keep your test scenarios in your project folders, not in the lab.

This guide explains how to use Load Testing Lab to test **any project** without copying files into the lab repository.

---

## Table of Contents

- [Overview](#overview)
- [Quick Reference](#quick-reference)
- [Simple Scenarios](#simple-scenarios-single-file)
- [Complex Scenarios](#complex-scenarios-multiple-files)
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

---

## Quick Reference

```bash
# Simple: Run a local file
ltlab k6 -s ./my-test.js
ltlab artillery -s ./load-test.yml

# Complex: Mount project with helpers/data
ltlab k6 -p ./my-tests -s main.js
ltlab artillery -p ./load-tests -s stress.yml

# Dashboards: Link from your project
ltlab dashboard link ./my-dashboards  # Copies to custom/
ltlab restart -s grafana
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
  const res = http.get('https://api.myproject.com/health');
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

The entire `tests/k6/` directory is mounted at `/project` in the container, so all imports resolve correctly.

### Helper File Example

```javascript
// tests/k6/helpers/auth.js
import http from 'k6/http';

const AUTH_URL = 'https://auth.myproject.com/token';

export function getAuthToken() {
  const res = http.post(AUTH_URL, {
    client_id: __ENV.CLIENT_ID || 'test-client',
    client_secret: __ENV.CLIENT_SECRET || 'test-secret',
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

## Custom Grafana Dashboards

Add your own dashboards to visualize project-specific metrics.

### Linking Dashboards

The `link` command copies your dashboard JSON files to the lab's `custom/` folder:

```bash
# Link your dashboards (copies to grafana/dashboards/custom/)
ltlab dashboard link ~/projects/my-api/dashboards

# Restart Grafana to load them
ltlab restart -s grafana

# View in Grafana
open http://localhost:3000
# Dashboards appear under "custom" folder
```

> **Why copy instead of symlink?** Docker containers can't follow symlinks that point outside the mounted directory. Copying ensures the dashboards are accessible inside the container.

### Source of Truth

- **Your project folder** = source of truth (tracked by your project's git)
- **Lab's `custom/` folder** = copy (ignored by lab's git)
- **To sync changes**: Run `ltlab dashboard link <dir>` again

### Managing Dashboards

```bash
# List all dashboards (built-in + custom)
ltlab dashboard list

# Remove custom dashboards
ltlab dashboard unlink

# Re-sync from your project after changes
ltlab dashboard link ~/projects/my-api/dashboards
ltlab restart -s grafana
```

### Creating Custom Dashboards

1. **Export from Grafana UI**: 
   - Open existing dashboard
   - Settings → JSON Model → Copy
   - Save as `.json` file

2. **Create from scratch**:
   - Use Grafana UI to create dashboard
   - Export when done

3. **Modify built-in dashboards**:
   - Copy from `grafana/dashboards/`
   - Modify and save in your project
   - Link with `ltlab dashboard link`

### Dashboard File Format

```json
{
  "dashboard": {
    "id": null,
    "uid": null,
    "title": "My API Performance",
    "tags": ["my-api", "performance"],
    "timezone": "browser",
    "panels": [
      // ... panel definitions
    ],
    "schemaVersion": 38,
    "version": 1
  },
  "overwrite": true
}
```

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
ltlab restart -s grafana

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
      
      - name: Setup Load Testing Lab
        run: |
          git clone https://github.com/destbreso/load-testing-lab.git ~/ltlab
          cd ~/ltlab && npm install && npm link
          ltlab start
          
      - name: Run Load Tests
        run: |
          ltlab k6 -p ./tests/k6 -s smoke-test.js
          
      - name: Cleanup
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
  baseUrl: __ENV.TARGET_URL || 'http://localhost:5000',
  apiKey: __ENV.API_KEY || 'test-key',
  timeout: __ENV.TIMEOUT || '30s',
};
```

```bash
# Pass variables when running
TARGET_URL=https://staging.myapi.com ltlab k6 -p ./tests/k6 -s main.js
```

### 3. Reusable Helpers

Create shared helper modules:

```javascript
// helpers/http.js
import http from 'k6/http';
import { check } from 'k6';

export function apiRequest(method, path, body = null, headers = {}) {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:5000';
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
    scenario: 'checkout-flow',
  },
};
```

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

// Correct imports:
import { helper } from './helpers/auth.js';      // /project/helpers/auth.js
import data from './data/users.json';            // /project/data/users.json

// Wrong:
import { helper } from '../helpers/auth.js';     // Goes outside /project
```

### Dashboard Not Appearing

**Problem**: Linked dashboards don't show in Grafana

**Solution**: Restart Grafana after linking

```bash
ltlab dashboard link ./dashboards
ltlab restart -s grafana
# Wait a few seconds for Grafana to restart
open http://localhost:3000
```

### Permission Issues

**Problem**: Can't read files in mounted directory

**Solution**: Check file permissions

```bash
# Make sure files are readable
chmod -R 755 ./tests/k6/

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
