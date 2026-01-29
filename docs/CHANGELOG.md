# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
  - `artillery/scenarios/inspection-flow.yml`
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
- **k6 scripts with errors** - Fixed configuration import in `inspection-flow.js`
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
- **k6/scenarios/inspection-flow.js** - Added correct config import
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
docker-compose build

# 3. Restart stack
docker-compose up -d

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

**Last Updated:** January 29, 2026
