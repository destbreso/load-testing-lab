# **Load Testing Lab – Integrating with CI/CD**
**Part of:** [Load Testing Lab Series](art0.md) | **Previous:** [← Metrics Deep Dive](art4.md) | **Next:** [Mock APIs & Workers →](art6.md)

**Estimated reading time:** 8–10 minutes

---

> 💡 **Series Context:** This article assumes you can run tests locally (covered in [Articles 2-3](../basic/art2.md)) and understand metrics ([Article 4](art4.md)). We'll now automate these tests in CI/CD pipelines.
In the previous articles, we explored **setting up Load Testing Lab**, running various **load scenarios**, and interpreting **metrics with Grafana**. Now, we’re going to take it a step further: integrating the lab into your **CI/CD pipelines**.

Automating load testing ensures that performance checks aren’t forgotten, and your team can **catch regressions early**, without manual intervention. In this tutorial, we’ll show how to spin up the lab, run tests, and collect metrics within GitHub Actions or GitLab CI—using completely generic setups so you can adapt them to any project.

---

## **Why CI/CD Integration Matters**

Manual load tests are useful for occasional checks, but they come with limitations:

* Tests may be skipped if developers are busy.
* Results can’t be compared easily across different builds or branches.
* Bottlenecks might go unnoticed until production.

By integrating **Load Testing Lab** into CI/CD:

* Every commit or merge can trigger automated load tests.
* Historical results are stored in InfluxDB for trend analysis.
* Alerts or reports can notify your team of performance regressions immediately.

In short, you make load testing **a natural part of your development workflow**.

---

## **Preparing the Lab for CI/CD**

Before automating, ensure the lab can run **headlessly**:

1. All services should start via `docker-compose up -d`.
2. Test scripts (k6 or Artillery) must accept **environment variables** for the target API, concurrency, and duration.
3. Metrics database (InfluxDB) and dashboards (Grafana) should start with default credentials configured via `.env`.

**Tip:** CI runners often have limited resources, so reduce concurrency or test duration for each pipeline run.

---

## **Example: GitHub Actions**

Let’s create a workflow that:

1. Spins up Load Testing Lab.
2. Runs a k6 test scenario.
3. Stores metrics for review.

**`.github/workflows/load-testing.yml`:**

```yaml
name: Load Testing

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  load-test:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Create .env file
        run: |
          echo "TARGET_API_URL=http://toy-api:5000" >> .env
          echo "CONCURRENCY=30" >> .env
          echo "DURATION=60s" >> .env
          echo "INFLUXDB_USER=admin" >> .env
          echo "INFLUXDB_PASSWORD=admin123" >> .env
          echo "INFLUXDB_ORG=myorg" >> .env
          echo "INFLUXDB_BUCKET=loadtests" >> .env

      - name: Start Load Testing Lab
        run: docker-compose up -d

      - name: Wait for services to be ready
        run: |
          sleep 10
          docker-compose ps

      - name: Run k6 fast scenario
        run: docker-compose run --rm k6 run /k6/scenarios/toy-fast.js

      - name: Run k6 stress scenario  
        run: docker-compose run --rm k6 run /k6/scenarios/toy-stress.js
        continue-on-error: true

      - name: Tear down lab
        run: docker-compose down
```

**Notes:**

* The workflow can run on `push` or `pull_request`.
* Environment variables configure the lab and target API dynamically.
* Metrics can be exported or saved as JSON for historical tracking.

---

## **Example: GitLab CI**

For GitLab users, a similar setup works. `.gitlab-ci.yml` snippet:

```yaml
stages:
  - load_test

load_test:
  image: docker:24.0
  services:
    - docker:dind
  script:
    - docker-compose up -d
    - docker-compose run --rm k6 run /k6/scenarios/custom-flow.js
    - docker-compose down
  only:
    - main
    - develop
```

This shows how **generic and portable** the lab is. You can plug it into almost any pipeline without project-specific modifications.

---

## **Storing Historical Metrics**

Keeping historical metrics allows trend analysis and performance regression detection:

1. Export InfluxDB metrics after each run:

```bash
docker-compose exec influxdb influx export bucket loadtests --file /tmp/loadtests_export.json
```

2. Store these files as **artifacts** in CI/CD:

* GitHub Actions: `actions/upload-artifact`
* GitLab CI: `artifacts` keyword

3. Use Grafana dashboards to compare **current vs. previous runs**, spotting regressions early.

---

## **Best Practices for CI/CD Load Testing**

1. **Use staging environments**: Never point CI tests to production databases or live APIs.
2. **Keep tests concise**: CI runners often have limited time and resources; use shorter scenarios or lower concurrency.
3. **Automate reports**: Send Grafana snapshots or CSV exports to team channels.
4. **Isolate metrics**: Each pipeline run should have its own bucket or tag in InfluxDB.
5. **Combine scenarios**: Run smoke tests on every commit, full load tests nightly or weekly.

---

## **Conclusion**

By integrating **Load Testing Lab** into CI/CD pipelines, load testing becomes **continuous, reproducible, and actionable**. Developers and QA engineers can catch performance regressions early, compare results across branches, and ensure systems are robust before hitting production.

With the foundation from articles 1–4, you now have a complete workflow: **setting up the lab, running realistic scenarios, analyzing metrics, and automating tests**. This closes the loop, giving you **a professional-grade, reusable testing environment** applicable to any project.

In the next complementary series (optional), we could explore **multi-environment setups, synthetic data generation, and automated scenario libraries**, extending the lab even further.
