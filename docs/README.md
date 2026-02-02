# Load Testing Lab Documentation

> **Production-ready load testing platform** with k6, Artillery, InfluxDB v2, and Grafana

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![Grafana](https://img.shields.io/badge/grafana-integrated-orange)
![k6](https://img.shields.io/badge/k6+xk6--influxdb-working-brightgreen)
![InfluxDB](https://img.shields.io/badge/influxdb-v2-blue)
![Artillery](https://img.shields.io/badge/artillery-working-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

## 📚 Complete Course Available

**New to load testing?** This project is complemented by a complete article series available at:

🎓 **[destbreso.com - Load Testing Course →](https://destbreso.com)**

- 13 articles (3 basic + 10 advanced)
- 100% reproducible examples
- Beginner to expert progression
- Also available locally in [`/blog`](../blog/README.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Detailed Documentation](#detailed-documentation)
4. [Project Status](#project-status)
5. [Architecture](#architecture)
6. [Contributing](#contributing)

---

## Overview

The **Load Testing Lab** is a containerized platform for performance testing and load simulation. It enables you to:

✅ Test API performance under high concurrency  
✅ Simulate realistic arrival patterns and user behavior  
✅ Measure latency, throughput, and error rates  
✅ Visualize real-time metrics with 6 Grafana dashboards  
✅ Test development and production environments safely  
✅ Reuse across multiple projects with minimal setup  

### Why This Project?

**Problem:** Setting up load testing infrastructure is complex:
- Manual k6 + InfluxDB v2 integration requires custom compilation
- Artillery has no native InfluxDB v2 support
- Grafana dashboard configuration is time-consuming
- Token management and data sources must be manually synchronized
- **Multiple projects = multiple stacks?** Duplicating infrastructure per project creates maintenance nightmares

**The Multi-Project Problem:**
If you have 3-5 projects that need load testing, the "obvious" solution is a stack per project. But this leads to:
- Configuration drift between projects
- Onboarding friction for new team members
- 5x maintenance overhead for updates
- Wasted resources running duplicate infrastructure

**"Why not just a docker-compose.yml?"**

You could wire up k6, InfluxDB, and Grafana in a compose file. That's the logical first step. And it works—I used exactly that for years.

But here's what happens in practice: every time you come back after a few months, you re-learn it. "How did I run tests? What was the password? Which dashboard?" The compose file persists, but your memory doesn't.

And when you want to test a new endpoint, try a new dashboard, or onboard a teammate:
- How do you know the stack works? (Need something to test against)
- How do you learn/remember the patterns? (No examples to start from)
- How do you onboard teammates—or yourself after 3 months? (No documentation)
- How do you verify dashboards are correct? (No known-good test data)

**Solution:** This lab is that docker-compose approach, **but with steroids**:
- ✅ **Toy API included** – 8 endpoints to test the stack, learn patterns, onboard teammates
- ✅ **Ready-to-run scenarios** – Dozens of k6 and Artillery examples
- ✅ **6 pre-configured dashboards** – Tested and working out of the box
- ✅ **CLI for ergonomics** – `ltlab start` instead of docker-compose flags
- ✅ **13-article course** – From basics to advanced, everything documented
- ✅ **One lab, many projects** – Use with any project without per-project setup
- ✅ **External scenarios & dashboards** – Keep tests in your project repos
- ✅ Precompiled k6 with xk6-influxdb (no Go toolchain needed)
- ✅ Artillery integration via Telegraf (transparent)

### Who Is This For?

- **Backend Developers** - Test API performance before production
- **QA Engineers** - Validate system behavior under load
- **DevOps Engineers** - Integrate load testing in CI/CD pipelines
- **Performance Engineers** - Conduct comprehensive performance analysis
- **Students/Learners** - Learn load testing with ready-to-use environment

---

## Quick Start

### Prerequisites

- Docker >= 24.0
- Docker Compose >= 2.18
- Node.js >= 18 (for CLI)

### 1-Minute Demo

```bash
# Clone repository
git clone https://github.com/destbreso/load-testing-lab.git
cd load-testing-lab

# Install dependencies
npm install

# Start services
docker-compose up -d

# Wait for initialization (5-10 seconds)
sleep 10

# Run first k6 test
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js

# Open Grafana
open http://localhost:3000
# Login: admin / admin123
```

**Expected result:**
- ✅ k6 reports metrics (http_req_duration, http_reqs, etc.)
- ✅ Grafana displays data in dashboards
- ✅ InfluxDB stores time-series metrics

### Using the CLI (Recommended)

```bash
# Install CLI globally
npm link

# Start lab
ltlab start

# Run tests
ltlab k6 -s toy-fast.js
```

### Using With Your Own Projects

The CLI auto-detects local files—no need to copy them into the lab:

```bash
# From your project directory
cd ~/projects/my-api

# Run your local test (auto-mounted)
ltlab k6 -s ./tests/load/stress-test.js

# For scenarios with imports, use project mode
ltlab k6 -p ./tests/load -s main.js

# Add your custom dashboards
ltlab dashboard link ./tests/load/dashboards
ltlab restart -s grafana
```

**📚 Full guide:** [EXTERNAL_PROJECTS.md](EXTERNAL_PROJECTS.md)

### Source of Truth: Each Project Owns Its Tests

The lab is **infrastructure**. Your project is the **source of truth** for its tests and dashboards.

| Component             | Lives in...       | Owned by...     |
|-----------------------|-------------------|-----------------|
| k6, Grafana, InfluxDB | The lab           | Lab maintainers |
| Test scenarios        | Your project repo | Your team       |
| Custom dashboards     | Your project repo | Your team       |

**Benefits:**
- Tests versioned with your code (same PR adds endpoint + test)
- Natural team ownership (no coordination bottlenecks)
- Clean separation (improve lab = everyone benefits; improve tests = your project benefits)
- Simple onboarding (one lab to learn, tests where you expect them)

**Next steps:** See [SETUP.md](SETUP.md) for detailed installation and [USAGE.md](USAGE.md) for running tests.

---

## Detailed Documentation

| Document                                         | Description                                             |
|--------------------------------------------------|---------------------------------------------------------|
| **[SETUP.md](SETUP.md)**                         | Installation, configuration, and environment setup      |
| **[USAGE.md](USAGE.md)**                         | Running tests with k6, Artillery, and CLI               |
| **[EXTERNAL_PROJECTS.md](EXTERNAL_PROJECTS.md)** | **NEW** - Use with your own projects and external files |
| **[DASHBOARDS.md](DASHBOARDS.md)**               | Grafana dashboards guide and query reference            |
| **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**     | Common issues and solutions                             |
| **[CONTRIBUTING.md](CONTRIBUTING.md)**           | How to contribute to the project                        |
| **[CHANGELOG.md](CHANGELOG.md)**                 | Version history and changes                             |

### Additional Resources

- **[CLI Documentation](../cli/README.md)** - Complete CLI command reference
- **[Blog Series](../blog/README.md)** - 13-article course on load testing
- **[Toy API Reference](../toy-api/README.md)** - Built-in test API documentation
- **[Production Mode Guide](PRODUCTION_MODE.md)** - High-scale testing configuration
- **[Artillery Integration Guide](ARTILLERY_INFLUXDB_GUIDE.md)** - Detailed Artillery setup

---

## Project Status

| Component                | Status     | Notes                              |
|--------------------------|------------|------------------------------------|
| **k6 + xk6-influxdb**    | 🟢 Working | Automatic metrics to InfluxDB v2   |
| **InfluxDB v2**          | 🟢 Working | Stores and queries metrics         |
| **Grafana**              | 🟢 Working | 6 dashboards preconfigured         |
| **Toy API**              | 🟢 Working | Test API with 8 endpoints          |
| **Artillery + Telegraf** | 🟢 Working | Transparent integration via StatsD |
| **Docker Compose**       | 🟢 Working | Complete stack in containers       |
| **Professional CLI**     | 🟢 Working | 18 commands for full control       |
| **External Projects**    | 🟢 Working | Mount scenarios from any folder    |
| **Custom Dashboards**    | 🟢 Working | Link/copy external dashboards      |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     LOAD TESTING LAB                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                    ┌──────────────┐       │
│  │   k6 Tests  │───── HTTP ─────────>│   Toy API    │       │
│  │  (prebuilt) │                    │  (Express.js)│       │
│  └──────┬──────┘                    └──────────────┘       │
│         │                                                   │
│         │ xk6-influxdb                                      │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────┐                                       │
│  │   InfluxDB v2   │◀───── Telegraf ◀──── Artillery        │
│  │  (Time Series)  │        (StatsD)                       │
│  └────────┬────────┘                                       │
│           │                                                 │
│           │ Flux Query API                                  │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │    Grafana      │  6 Dashboards:                        │
│  │  Visualization  │  • k6 (Basic, Pro, Elite)             │
│  │                 │  • Artillery (Basic, Pro, Elite)      │
│  └─────────────────┘                                       │
│                                                             │
│  CLI: 16 commands for orchestration and test management    │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

1. **k6 Integration**
   - Precompiled with xk6-influxdb extension
   - Automatic metric sending to InfluxDB v2
   - No manual configuration required in test scripts

2. **Artillery Integration**
   - Transparent StatsD metrics via Telegraf
   - Automatic forwarding to InfluxDB
   - Unified metric storage with k6

3. **Grafana Dashboards**
   - 6 pre-configured dashboards (3 for k6, 3 for Artillery)
   - Real-time visualization
   - Professional layouts (Basic, Pro, Elite)

4. **Professional CLI**
   - 16 commands for complete control
   - Blueprint system for test generation
   - Interactive wizards for configuration
   - See [CLI Documentation](../cli/README.md)

---

## Core Components

### 1. k6 + xk6-influxdb (Load Generator)

- **Purpose**: Execute HTTP load tests
- **Port**: N/A (runs on-demand)
- **Key Features**:
  - Precompiled with InfluxDB v2 extension
  - Supports VUs, scenarios, thresholds
  - Custom metrics and checks
  - Zero-configuration metric sending

### 2. Artillery + Telegraf (Alternative Load Generator)

- **Purpose**: Alternative testing tool with different approach
- **Integration**: Via Telegraf StatsD receiver
- **Key Features**:
  - YAML-based configuration
  - Socket.io and WebSocket support
  - Transparent metric forwarding

### 3. InfluxDB v2 (Metrics Storage)

- **Port**: 8086
- **UI**: http://localhost:8086
- **Credentials**: admin / admin123
- **Purpose**: Time-series database for test metrics
- **Auto-configured**: Token generation and bucket creation

### 4. Grafana (Visualization)

- **Port**: 3000
- **UI**: http://localhost:3000
- **Credentials**: admin / admin123
- **Purpose**: Real-time dashboards and metric visualization
- **Dashboards**: 6 pre-configured (auto-provisioned)

### 5. Toy API (Test Target)

- **Port**: 5000
- **Purpose**: Built-in API for testing
- **Endpoints**: 8 different behaviors (health, fast, slow, error, cpu, io, users, jobs)
- **Documentation**: [Toy API README](../toy-api/README.md)

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Code of conduct
- Development workflow
- Testing guidelines
- Pull request process

---

## License

MIT License - See [LICENSE](../LICENSE) for details

---

## Support & Community

- **Issues**: [GitHub Issues](https://github.com/destbreso/load-testing-lab/issues)
- **Course**: [destbreso.com](https://destbreso.com)
- **Documentation**: This docs folder
- **Blog**: [Article series](../blog/README.md)

---

**Last Updated:** January 29, 2026  
**Version:** 1.2.0  
**Status:** ✅ Production Ready
