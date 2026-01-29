# Setup Guide

Complete installation and configuration guide for the Load Testing Lab.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Environment Setup](#environment-setup)
5. [Token Management](#token-management)
6. [Testing External APIs](#testing-external-apis)
7. [Production Mode](#production-mode)
8. [Verification](#verification)

---

## Prerequisites

### Required Software

- **Docker** >= 24.0 ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** >= 2.18 (included with Docker Desktop)
- **Node.js** >= 18 ([Install Node.js](https://nodejs.org/))
- **Git** (for cloning repository)

### System Requirements

- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 2GB free space
- **CPU**: 2 cores minimum
- **OS**: macOS, Linux, or Windows with WSL2

### Verify Installation

```bash
docker --version          # Should show >= 24.0
docker-compose --version  # Should show >= 2.18
node --version           # Should show >= 18.x
```

---

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/destbreso/load-testing-lab.git
cd load-testing-lab
```

### 2. Install Dependencies

```bash
npm install
```

This installs the CLI and helper scripts.

### 3. Start Services

**Option A: Using CLI (Recommended)**

```bash
# Start all services
npm start

# Or with global ltlab command
npm link
ltlab start
```

**Option B: Direct Docker**

```bash
docker-compose up -d
```

### 4. Wait for Initialization

Services need 5-10 seconds to initialize:

```bash
# Check status
docker-compose ps

# Wait for healthy status
docker-compose logs influxdb | grep "Started HTTP"
```

### 5. Verify Installation

```bash
# Check all services are running
docker-compose ps

# Expected output:
# NAME          SERVICE    STATUS    PORTS
# influxdb      influxdb   Up        0.0.0.0:8086->8086/tcp
# grafana       grafana    Up        0.0.0.0:3000->3000/tcp
# toy-api       toy-api    Up        0.0.0.0:5000->5000/tcp
# telegraf      telegraf   Up        8092/udp, 8094/tcp, 8125/udp
```

---

## Configuration

### Environment Variables

The lab uses a `.env` file for configuration. Create it from the template:

```bash
cp .env.example .env
```

### Key Configuration Options

```env
# InfluxDB Configuration
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=loadtests
INFLUXDB_TOKEN=your-generated-token-here
INFLUXDB_ADMIN_USER=admin
INFLUXDB_ADMIN_PASSWORD=admin123

# Target API (change for different test targets)
TARGET_API_URL=http://toy-api:5000

# k6 Test Configuration
CONCURRENCY=50          # Virtual users
DURATION=30s           # Test duration
RAMP_UP=10s            # Ramp-up time

# Grafana Configuration
GRAFANA_PORT=3000
GRAFANA_ADMIN_PASSWORD=admin123
```

### Interactive Configuration

Use the CLI wizard for guided setup:

```bash
# Interactive configuration
ltlab configure

# Or via npm script
npm run configure
```

The wizard will:
1. Create `.env` if it doesn't exist
2. Generate InfluxDB token
3. Configure Grafana datasource
4. Validate connectivity

---

## Environment Setup

### Development Mode (Default)

For local testing and development:

```bash
# Start with docker-compose.yml
docker-compose up -d

# Single instance of each service
# Logs visible for debugging
# Manual restart required
```

**Use cases:**
- ✅ Local development
- ✅ Learning and experimentation
- ✅ Quick tests
- ✅ Debugging

### Production Mode

For high-scale testing and CI/CD:

```bash
# Start with docker-compose.prod.yml
docker-compose -f docker-compose.prod.yml up -d --scale k6=5 --scale artillery=3

# Or via npm script
npm run start:prod
```

**Features:**
- ✅ Auto-restart on failure
- ✅ Multiple replicas for load distribution
- ✅ Resource limits configured
- ✅ Optimized for long-running tests

**Use cases:**
- ✅ Stress testing
- ✅ Soak testing (hours/days)
- ✅ CI/CD pipelines
- ✅ Distributed load generation

See [PRODUCTION_MODE.md](PRODUCTION_MODE.md) for complete guide.

---

## Token Management

### Why Tokens Are Needed

InfluxDB v2 uses tokens for authentication. The lab requires a token for:
- k6 to send metrics to InfluxDB
- Artillery (via Telegraf) to send metrics
- Grafana to read metrics for visualization

### Automatic Token Generation

The easiest method is using the provided script:

```bash
# Generate and display token
node scripts/generate-influx-token.js

# Auto-update .env file
node scripts/generate-influx-token.js --update-env
```

### Manual Token Generation

```bash
# Inside InfluxDB container
docker exec -it influxdb influx auth create \
  --read-buckets \
  --write-buckets \
  --org myorg \
  --description "Load Testing Token"

# Copy the token and update .env
```

### Token Validation

Verify your token works:

```bash
# Check token connectivity
node scripts/check-influx-token.js

# Expected output:
# ✅ InfluxDB Connection: OK
# ✅ Token Valid: yes
# ✅ Bucket 'loadtests' exists: yes
# ✅ Organization 'myorg' exists: yes
```

### Synchronizing Grafana

After generating a new token, update Grafana:

1. Edit `grafana/provisioning/datasources/influxdb.yaml`
2. Replace token in `secureJsonData.token` field
3. Restart Grafana:

```bash
docker-compose restart grafana

# Or via CLI
ltlab restart -s grafana
```

---

## Testing External APIs

### Testing Internal Services (Default)

By default, tests target the built-in Toy API:

```env
TARGET_API_URL=http://toy-api:5000
```

### Testing External URLs

To test external APIs (production, staging, internet):

```bash
# External domain
export TARGET_API_URL=https://api.example.com

# Or update .env
echo "TARGET_API_URL=https://api.example.com" >> .env

# Run test
ltlab k6 -s toy-fast.js
```

### Testing Host Machine APIs

When your API runs on `localhost` outside Docker:

**macOS / Windows:**
```env
TARGET_API_URL=http://host.docker.internal:3031
```

**Linux:**
```env
# Option 1: Use host gateway (Docker 20.10+)
TARGET_API_URL=http://host.gateway:3031

# Option 2: Use actual host IP
TARGET_API_URL=http://192.168.1.100:3031
```

**Why?** Inside Docker containers, `localhost` refers to the container itself, not your host machine.

### Quick Reference

| Scenario | TARGET_API_URL |
|----------|----------------|
| Toy API (internal) | `http://toy-api:5000` |
| External domain | `https://api.example.com` |
| External IP | `http://52.123.45.67:8080` |
| Host machine (Mac/Win) | `http://host.docker.internal:3031` |
| Host machine (Linux) | `http://192.168.1.100:3031` |

---

## Production Mode

### When to Use

- High-scale load testing (1000+ VUs)
- Long-running soak tests (hours/days)
- Stress testing to find breaking points
- CI/CD pipeline integration

### Configuration

```bash
# Scale services
docker-compose -f docker-compose.prod.yml up -d \
  --scale k6=5 \
  --scale artillery=3

# Or via npm
npm run start:prod -- --scale k6=5
```

### Best Practices

1. **Start with low replicas** (2-3) and scale gradually
2. **Monitor resources** with `docker stats`
3. **Use development mode for debugging** (easier to troubleshoot)
4. **Check logs regularly** during long tests
5. **Clean up after tests** with `npm run stop:prod`

### Common Issues

**Problem:** Container name conflicts

```bash
# Solution: Stop dev mode first
docker-compose down
npm run start:prod
```

**Problem:** High CPU/memory usage

```bash
# Solution: Reduce replicas
docker-compose -f docker-compose.prod.yml up -d --scale k6=2
```

See [PRODUCTION_MODE.md](PRODUCTION_MODE.md) for troubleshooting guide.

---

## Verification

### 1. Check Services

```bash
# All services running
docker-compose ps

# Should show 4 services: influxdb, grafana, toy-api, telegraf
```

### 2. Test InfluxDB

```bash
# Open InfluxDB UI
open http://localhost:8086

# Login: admin / admin123
# Verify bucket 'loadtests' exists
```

### 3. Test Grafana

```bash
# Open Grafana
open http://localhost:3000

# Login: admin / admin123
# Navigate to Dashboards → Browse
# Should see 6 dashboards (3 k6 + 3 Artillery)
```

### 4. Run Test

```bash
# Quick k6 test
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js

# Expected output:
# ✅ K6 InfluxDB configured
# ✅ output: InfluxDBv2 (http://influxdb:8086)
# ✅ Test completes with metrics
```

### 5. Verify Metrics in Grafana

1. Open Grafana: http://localhost:3000
2. Go to "k6 - Basic (War Room)" dashboard
3. Adjust time range to "Last 15 minutes"
4. Should see metrics from your test

---

## Next Steps

- **[USAGE.md](USAGE.md)** - Learn how to run tests
- **[DASHBOARDS.md](DASHBOARDS.md)** - Explore Grafana dashboards
- **[CLI Documentation](../cli/README.md)** - Master the CLI commands
- **[Blog Series](../blog/README.md)** - Follow the complete course

---

## Troubleshooting

If you encounter issues during setup, see:

- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common problems and solutions
- **[DIAGNOSIS_AND_SOLUTION.md](DIAGNOSIS_AND_SOLUTION.md)** - Technical deep dive
- **[Blog: Getting Started Guide](../blog/basic/art2.md)** - Step-by-step tutorial with examples
- **[Blog: Architecture Overview](../blog/advanced/art1.md)** - Strategic approaches to setup

---

**Last Updated:** January 29, 2026
