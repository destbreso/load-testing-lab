# Contributing Guide

Thank you for considering contributing to Load Testing Lab! This project is **open-source (MIT License)** and is a gift to the developer community. 🎁

**By contributing, you agree that your contributions will be licensed under the same MIT License as the project.**

---

## Table of Contents

1. [Contribution vs Customization](#contribution-vs-customization)
2. [Code of Conduct](#code-of-conduct)
3. [How to Contribute](#how-to-contribute)
4. [Development Setup](#development-setup)
5. [Style Guides](#style-guides)
6. [Pull Request Process](#pull-request-process)
7. [Project Structure](#project-structure)
8. [Areas Needing Contribution](#areas-needing-contribution)

---

## Contribution vs Customization

It's important to distinguish between **contributing to the project** and **customizing for your use**:

### Contributing to the Project (Pull Requests)

Contributions should be **generalizable** and useful for the community:

✅ **Welcome:**
- New integrations (testing tools, datasources)
- CLI command improvements that benefit everyone
- Bug fixes
- General documentation improvements
- Common scenario examples (REST API, GraphQL, WebSockets)
- Generic dashboards that work for any API
- Reusable automation scripts

❌ **Not contributions (but you can use them freely):**
- Configurations specific to your company/project
- Highly specialized dashboards for your domain
- Test scenarios specific to your application
- Integrations with internal proprietary services

### Customization for Personal Use (Fork/Download)

For project-specific needs, **simply fork or download the repository** and modify what you need:

🎨 **Free customization:**
- Create dashboards specific to your business
- Modify existing panels for your needs
- Add test scenarios for your specific flows
- Integrate with your internal services
- Adapt configurations to your infrastructure
- Change colors, thresholds, alerts according to your SLAs

**You don't need to submit PRs for specific customizations** - the project is designed to be adapted to your needs.

---

## Code of Conduct

This project follows a professional code of conduct. All contributors are expected to:

- Be respectful and constructive in their comments
- Accept constructive criticism professionally
- Focus on what is best for the community
- Show empathy towards other community members

---

## How to Contribute

### 🐛 Reporting Bugs

Before creating a bug issue:
1. **Verify** that the bug hasn't already been reported
2. **Review** the [Troubleshooting](TROUBLESHOOTING.md) documentation
3. **Consult** [DIAGNOSIS_AND_SOLUTION.md](DIAGNOSIS_AND_SOLUTION.md)

If you confirm it's a new bug, create an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Docker version, etc.)
- Relevant logs

### 💡 Suggesting Improvements

For new features or improvements:
1. Open an issue describing the proposal
2. Explain the use case
3. Mention if you'd be willing to implement it

### 🔧 Contributing Code

1. **Fork** the repository: https://github.com/destbreso/load-testing-lab
2. **Create a branch** from `main`: `git checkout -b feature/my-feature`
3. **Commit** your changes with descriptive messages
4. **Push** to your fork: `git push origin feature/my-feature`
5. **Open a Pull Request** to `main`

---

## Development Setup

### Prerequisites

- Docker, with Docker Compose v2 or later (the `docker compose` plugin, or the standalone `docker-compose` v2 binary; the CLI uses whichever it finds)
- Node.js 22.13 or later
- Git

### Installation

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/load-testing-lab.git
cd load-testing-lab

# 2. Install CLI dependencies and link the ltlab command
npm install
npm link

# 3. Create the lab's .env (it also generates the InfluxDB token)
ltlab configure

# 4. Start services (returns when every service is ready)
ltlab start

# 5. Verify configuration
npm run check-influx

# 6. Run verification test
ltlab k6 -s toy-fast.js
```

### Local Development

```bash
# View logs, from the lab's root directory (services: influxdb, grafana, telegraf, toy-api)
docker compose logs -f

# Rebuild specific image
ltlab rebuild -s k6

# Run tests
ltlab k6 -s toy-mixed.js

# Check both pipelines end to end (k6 and Artillery to InfluxDB)
./scripts/e2e-test.sh

# Clean everything (DANGER: deletes all data)
ltlab purge
```

The `ltlab` commands work from any directory and read only the lab's `.env`, so you can try a change from another folder too.

---

## Style Guides

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New functionality
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, whitespace
- `refactor`: Code refactoring
- `test`: Add or modify tests
- `chore`: General maintenance

**Examples:**
```bash
feat(k6): add new stress test scenario
fix(grafana): correct a panel's Flux query
docs(readme): update troubleshooting section
chore(deps): update InfluxDB image to v2.7
```

### JavaScript Code

- Use `const` and `let`, avoid `var`
- 2-space indentation
- Double quotes for strings
- Semicolons at end of statements
- Descriptive variable names
- JSDoc comments for public functions

**Example:**
```javascript
/**
 * Simulates user login flow
 * @param {string} username - User identifier
 * @param {string} password - User password
 * @returns {boolean} Success status
 */
const login = (username, password) => {
  const response = http.post(`${BASE_URL}/login`, JSON.stringify({
    username,
    password
  }));
  return response.status === 200;
};
```

### Shell Scripts

- Shebang: `#!/bin/bash`
- Variables: `UPPER_CASE` for constants, `lower_case` for locals
- Always quote variables: `"$VAR"`
- Error handling: `set -e` at the beginning

**Example:**
```bash
#!/bin/bash
set -e

SCENARIO_NAME="$1"

if [ -z "$SCENARIO_NAME" ]; then
  echo "Error: scenario name required"
  exit 1
fi
```

### Docker

- Use specific image versions (avoid `:latest` in production)
- Prefer Alpine base images
- Use multi-stage builds to reduce size
- Add labels for metadata
- Define health checks in services
- Comment non-obvious steps

### Documentation

- Use correct Markdown syntax
- Logical heading hierarchy
- Specify language in code blocks (```bash, ```javascript)
- Use relative links for internal files
- Include practical examples
- Keep line length reasonable (< 120 chars)

---

## Pull Request Process

### Before Submitting

- [ ] Code works locally
- [ ] Tests pass (if applicable)
- [ ] Documentation is updated
- [ ] Commits follow Conventional Commits
- [ ] No hardcoded credentials or secrets
- [ ] No forgotten debug console.logs
- [ ] Code follows the [Style Guides](#style-guides)

### PR Template

```markdown
## Description
[Describe what this PR does and why]

## Type of change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that breaks existing functionality)
- [ ] Documentation update

## How has this been tested?
[Describe the tests you ran]

## Checklist:
- [ ] My code follows the style guides
- [ ] I have reviewed my own code
- [ ] I have commented complex code
- [ ] I have updated documentation
- [ ] My changes don't generate new warnings
- [ ] I have added tests (if applicable)
- [ ] Existing tests pass locally
```

### Review Process

1. **Automated checks** must pass (if configured)
2. **Code review** by at least one maintainer
3. **Testing** by reviewers
4. **Changes requested**: Respond to comments and make adjustments
5. **Approval**: Once approved, a maintainer will merge

### After Merge

- Your contribution will appear in the [CHANGELOG](CHANGELOG.md)
- You'll receive credit in the contributors section
- Thank you for contributing! 🎉

---

## Project Structure

```
load-testing-lab/
├── k6/                          # k6 runner
│   ├── Dockerfile               # k6 v1.8.1 built with xk6-output-influxdb v0.7.0 (pinned)
│   ├── entrypoint.sh            # Sends k6's metrics to InfluxDB when org, bucket and token are set
│   └── scenarios/               # Built-in scenarios (toy-*, chaos-*), each with its options inline
├── artillery/                   # Artillery runner
│   ├── Dockerfile               # artillery@2.0.34 on node:22-alpine
│   └── scenarios/               # Built-in scenarios (toy-*, chaos-*)
├── grafana/
│   ├── dashboards/              # The six built-in dashboards (General folder)
│   │   └── custom/              # Copies made by `ltlab dashboard link` (git-ignored)
│   └── provisioning/
│       ├── dashboards/          # dashboards.yaml: file provider, rescanned every 10 seconds
│       └── datasources/         # influxdb.yaml: token, org and bucket from the environment
├── telegraf/
│   └── telegraf.conf            # StatsD in (from Artillery), InfluxDB v2 out
├── toy-api/                     # Test API
│   ├── Dockerfile               # node:22-alpine, installed from yarn.lock
│   ├── package.json
│   ├── yarn.lock
│   └── src/
│       ├── index.js             # Express app, registers the routes
│       ├── routes/              # fast, slow, error, cpu, io, users, jobs, health
│       ├── workers/             # In-memory job queue and store
│       └── utils/
├── cli/                         # The ltlab CLI
│   ├── index.js                 # Entry point: registers every command
│   ├── commands/                # One file per command
│   ├── lib/                     # lab.js (lab root, .env, Docker Compose), run-scenario.js
│   └── blueprints/              # Templates for `ltlab generate` (k6/, artillery/)
├── scripts/                     # E2E and integration tests, InfluxDB helpers
│   ├── e2e-test.sh
│   ├── test-artillery-integration.sh
│   ├── reset-metrics.js         # Used by `ltlab reset` (reset-metrics.sh wraps it)
│   ├── check-influx-token.js    # npm run check-influx
│   ├── tail-influx.js           # npm run tail-influx
│   ├── run-k6.sh
│   └── run-artillery.sh
├── docs/                        # Documentation
│   ├── README.md
│   ├── SETUP.md
│   ├── USAGE.md
│   ├── DASHBOARDS.md
│   ├── TROUBLESHOOTING.md
│   ├── CONTRIBUTING.md
│   └── CHANGELOG.md
├── docker-compose.yml           # The lab's stack
├── docker-compose.prod.yml      # The same stack with restart policies
└── package.json                 # CLI dependencies and npm scripts
```

### Adding New Components

#### New k6 Scenario

1. Create file in `k6/scenarios/my-test.js`
2. Define options and default function
3. Don't configure InfluxDB manually: the image's entrypoint sends every run's metrics
4. Read the target from `__ENV.TARGET_API_URL`
5. Document the scenario if relevant

```javascript
// k6/scenarios/my-test.js
import http from "k6/http";
import { sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<200"],
  },
};

export default function () {
  http.get(`${__ENV.TARGET_API_URL}/endpoint`);
  sleep(1);
}
```

#### New Artillery Scenario

1. Create file in `artillery/scenarios/my-test.yml`
2. Keep the `publish-metrics` block of the other scenarios in its `config` (type `statsd`, host and port from `STATSD_HOST` and `STATSD_PORT`, prefix `artillery.`), or its metrics do not reach InfluxDB
3. Give its scenarios names without spaces (StatsD cuts a name at its first space)
4. For `ensure` thresholds or `expect` checks, list `ensure: {}` or `expect` under `plugins`, as `toy-fast.yml` and the chaos scenarios do

See [ARTILLERY_INFLUXDB_GUIDE.md](ARTILLERY_INFLUXDB_GUIDE.md) for what reaches InfluxDB.

#### New Grafana Dashboard

See detailed guide in [DASHBOARDS.md](DASHBOARDS.md#customizing-dashboards).

**Quick steps:**
1. Create dashboard in Grafana UI (http://localhost:3000)
2. Export JSON: Settings → JSON Model
3. Give it its own `uid` and `title`, point panels at the datasource with uid `influxdb`, and read `from(bucket: v.defaultBucket)` in queries
4. Save to `grafana/dashboards/your-dashboard.json`
5. Grafana loads it within 10 seconds, without a restart (it keeps no state, so the file is what counts)

**When to contribute a dashboard:**
- ✅ Generalizable and useful for community
- ✅ Uses common patterns
- ❌ Specific to your business logic

#### New Toy API Endpoint

1. Create route file in `toy-api/src/routes/`
2. Register route in `toy-api/src/index.js` (`app.use("/my-route", myRoute)`)
3. Rebuild: `ltlab rebuild -s toy-api` (a running toy API is recreated from the new image)
4. Try it: `curl http://localhost:5000/my-route`
5. If you add a dependency, update `toy-api/yarn.lock` too: the image installs with `yarn install --frozen-lockfile --production`, which fails when the lockfile is out of date

#### New CLI Command

1. Create command file in `cli/commands/`, exporting a default async function
2. Register it in `cli/index.js` (`program.command(...).description(...).action(...)`)
3. Use the helpers in `cli/lib/lab.js`: `compose(args)` runs Docker Compose from the lab's root, `readLabEnv()` reads the lab's `.env`, and `exitCodeOf(err)` turns a failure into `process.exitCode`, so the command works from any directory and reports failures through its exit code
4. Test with `ltlab your-command`, also from another directory
5. Document in [cli/README.md](../cli/README.md)

---

## Custom Metrics Examples

### Tracking Business Metrics

The pre-built dashboards track technical metrics (response time, RPS, errors). For **domain-specific metrics**, add custom tracking in your k6 scripts:

#### LLM Token Count
```javascript
import http from 'k6/http';
import { Trend } from 'k6/metrics';

const tokenCount = new Trend('llm_token_count');

export default function () {
  const res = http.post(`${__ENV.TARGET_API_URL}/completions`, payload);
  const data = JSON.parse(res.body);
  tokenCount.add(data.usage.total_tokens);
}
```

#### API Cost Tracking
```javascript
import { Counter, Trend } from 'k6/metrics';

const apiCost = new Counter('api_cost_usd');
const tokensUsed = new Trend('llm_tokens_used');

export default function () {
  const res = callLLMAPI();
  const tokens = extractTokens(res);
  const cost = (tokens / 1000) * 0.03; // $0.03 per 1K tokens
  
  tokensUsed.add(tokens);
  apiCost.add(cost);
}
```

#### Cache Performance
```javascript
import http from 'k6/http';
import { Rate } from 'k6/metrics';

const cacheHitRate = new Rate('cache_hits');

export default function () {
  const res = http.get(`${__ENV.TARGET_API_URL}/api/data`);
  const isCacheHit = res.headers['X-Cache-Status'] === 'HIT';
  cacheHitRate.add(isCacheHit);
}
```

**These custom metrics automatically flow to InfluxDB** and can be visualized in Grafana using Flux queries.

See [DASHBOARDS.md](DASHBOARDS.md#custom-metrics) for visualization examples.

---

## Areas Needing Contribution

### High Priority

- [ ] More test scenarios (WebSockets, GraphQL, gRPC)
- [ ] Additional Grafana dashboards (cache performance, database metrics)
- [ ] Automated integration tests
- [ ] Performance benchmarks and comparisons

### Medium Priority

- [ ] CLI enhancements (interactive wizards, better error messages)
- [ ] CI/CD examples (GitHub Actions, GitLab CI, Jenkins)
- [ ] Multi-environment support (dev, staging, prod)
- [ ] Distributed testing guide (multiple k6 instances)

### Documentation

- [ ] Translation to other languages (Spanish, Portuguese, Chinese)
- [ ] Video tutorials
- [ ] Real-world use case studies
- [ ] Migration guides from other tools

### Nice to Have

- [ ] Web UI for test management
- [ ] Slack/Discord notifications
- [ ] Automated report generation
- [ ] SLA violation alerting

---

## Questions?

If you have questions about contributing:

1. Review the [documentation](README.md)
2. Search existing issues on [GitHub](https://github.com/destbreso/load-testing-lab/issues)
3. Open an issue with the `question` label

---

## License

By contributing to this project, you agree that your contributions will be licensed under the [MIT License](../LICENSE).

For more details on rights and usage, see the main [README.md](README.md#license) file.

---

## Acknowledgments

Thank you for contributing! Your time and effort help make this project better for everyone. 🎉

Every contribution, no matter how small, is valued and appreciated. Together we're building better tools for the developer community.

---

## Additional Resources

- [Blog: Introduction to Load Testing Lab](https://destbreso.com/blog/why-a-dedicated-load-testing-lab) - Project philosophy and goals
- [Blog: Validation, Capacity and Resilience](https://destbreso.com/blog/performance-engineering-validation-capacity-resilience) - Strategic approaches to performance engineering
- [Blog Series Overview](https://destbreso.com/blog/series/load-testing-lab-guide) - Complete tutorial series
