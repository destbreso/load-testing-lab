#!/usr/bin/env node

import dotenv from "dotenv";
import { ENV_PATH } from "./lib/lab.js";

// The lab's own .env, whatever directory the CLI is run from
dotenv.config({ path: ENV_PATH, quiet: true });

import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Command } from "commander";
import chalk from "chalk";

// Commands
import startLab from "./commands/start.js";
import stopLab from "./commands/stop.js";
import resetMetrics from "./commands/reset.js";
import restartCmd from "./commands/restart.js";
import rebuildCmd from "./commands/rebuild.js";
import purgeCmd from "./commands/purge.js";
import runK6 from "./commands/k6.js";
import runArtillery from "./commands/artillery.js";
import showInfo from "./commands/info.js";
import configureEnv from "./commands/configure.js";
import chaosTest from "./commands/chaos.js";
import showMetrics from "./commands/metrics.js";
import runCmd from "./commands/run.js";
import generateCmd from "./commands/generate.js";
import dashboardCmd from "./commands/dashboard.js";

// Determinar __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Leer package.json manualmente
const pkgPath = join(__dirname, "../package.json");
const pkgRaw = await readFile(pkgPath, "utf-8");
const pkg = JSON.parse(pkgRaw);

const program = new Command();

program
  .name("ltlab")
  .description(
    chalk.cyan(
      "Load Testing Lab CLI - Professional load testing with k6 and Artillery",
    ),
  )
  .version(pkg.version)
  .addHelpText(
    "after",
    `
${chalk.bold("Quick Start:")}
  ${chalk.yellow("0.")} Create symlink:         ${chalk.green("npm link")}
  ${chalk.yellow("1.")} Configure environment:  ${chalk.green("ltlab configure")}
  ${chalk.yellow("2.")} Start the lab:          ${chalk.green("ltlab start")}
  ${chalk.yellow("3.")} Run a test:             ${chalk.green("ltlab k6 -s toy-fast.js")}
  ${chalk.yellow("4.")} Start your own:         ${chalk.green("ltlab generate -e k6 -n my-test")} ${chalk.dim("(then edit its endpoints)")}
  ${chalk.yellow("5.")} View dashboards:        ${chalk.green(`Open http://localhost:${process.env.GRAFANA_PORT || 3000}`)}
  ${chalk.yellow("6.")} View InfluxDB UI:       ${chalk.green(`Open http://localhost:${process.env.INFLUXDB_PORT_EXPORT || 8086}`)}

${chalk.bold("Common Workflows:")}
  ${chalk.dim("# Setup and configure")}
  ltlab configure                    ${chalk.dim("→ Interactive environment setup")}
  ltlab start                        ${chalk.dim("→ Start all services")}
  ltlab info                         ${chalk.dim("→ Check status")}

  ${chalk.dim("# Create and run tests")}
  ltlab k6 -s toy-fast.js            ${chalk.dim("→ Run a built-in k6 test against the toy API")}
  ltlab generate -e k6 -n my-test    ${chalk.dim("→ Create a k6 scenario from a blueprint, then edit its endpoints")}
  ltlab k6 -s my-test.js             ${chalk.dim("→ Run it")}
  ltlab artillery -s my-test.yml     ${chalk.dim("→ Run Artillery test")}

  ${chalk.dim("# Advanced testing")}
  ltlab run -e k6                    ${chalk.dim("→ Interactive test runner")}
  ltlab chaos                        ${chalk.dim("→ Chaos engineering with toy-api (tutorials/demos)")}

${chalk.bold("Resources:")}
  Documentation: ${chalk.cyan("./README.md")}
  CLI Guide:     ${chalk.cyan("./cli/README.md")}
  Course:        ${chalk.cyan("https://destbreso.com/blog/series/load-testing-lab-guide")}

${chalk.bold("Quick Links:")}  
  Grafana:       ${chalk.cyan(`http://localhost:${process.env.GRAFANA_PORT || 3000}`)}
  InfluxDB:      ${chalk.cyan(`http://localhost:${process.env.INFLUXDB_PORT_EXPORT || 8086}`)}

${chalk.bold("Copyright:")}
  MIT License
  © ${new Date().getFullYear()} ${chalk.cyan("David Estevez")}. All rights reserved.

  LICENSE: ${chalk.cyan("./LICENSE.md")}
`,
  );

// Core commands
program
  .command("start")
  .description("Start the lab stack with Docker Compose")
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Builds the k6 and Artillery images (cached after the first time), starts
  InfluxDB, Telegraf, Grafana and the toy API, and waits until each one is
  ready. Needs a .env file: create it with "ltlab configure".
  The k6 and Artillery containers start only when a test runs.

${chalk.bold("Examples:")}
  ${chalk.green("ltlab start")}                  ${chalk.dim("Start all services")}
  ${chalk.green("npm start")}                    ${chalk.dim("Alternative using npm script")}

${chalk.bold("After Starting:")}
  - Grafana:  ${chalk.cyan(`http://localhost:${process.env.GRAFANA_PORT || 3000}`)} (default: admin/admin123)
  - Toy API:  ${chalk.cyan(`http://localhost:${process.env.TOY_API_PORT || 5000}`)}
  - InfluxDB: ${chalk.cyan(`http://localhost:${process.env.INFLUXDB_PORT_EXPORT || 8086}`)} (default: admin/admin123)
`,
  )
  .action(startLab);

program
  .command("stop")
  .description("Stop all lab services")
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Stops and removes all running containers.
  ${chalk.yellow("Note:")} Metrics data in volumes is preserved.

${chalk.bold("Examples:")}
  ${chalk.green("ltlab stop")}                   ${chalk.dim("Stop all services")}
  ${chalk.green("npm stop")}                     ${chalk.dim("Alternative using npm script")}
`,
  )
  .action(stopLab);

program
  .command("configure")
  .description("Setup or update your .env file interactively")
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Interactive wizard that creates or updates the lab's .env, wherever
  you run it from. It keeps values already there, and generates the
  InfluxDB token on the first run: InfluxDB adopts that token when it
  starts for the first time, and k6, Telegraf and Grafana read it too.

${chalk.bold("Examples:")}
  ${chalk.green("ltlab configure")}              ${chalk.dim("Run interactive configuration")}

${chalk.bold("Default Values:")}
  TARGET_API_URL:     http://toy-api:5000
  INFLUXDB_ORG:       myorg
  INFLUXDB_BUCKET:    loadtests
  INFLUXDB_USER:      admin
  INFLUXDB_PASSWORD:  admin123
  GRAFANA_USER:       admin
  GRAFANA_PASSWORD:   admin123
  CONCURRENCY:        50
  DURATION:           60s
`,
  )
  .action(configureEnv);

program
  .command("generate")
  .description("Generate a new scenario blueprint")
  .option(
    "-e, --engine <engine>",
    "Engine to use (k6 or artillery)",
    (value) => {
      if (!["k6", "artillery"].includes(value)) {
        throw new Error('Engine must be "k6" or "artillery"');
      }
      return value;
    },
  )
  .option("-n, --name <name>", "Name for the new scenario file")
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Creates a new test scenario from predefined blueprints.
  Interactive wizard guides you through template selection.

${chalk.bold("Available Blueprints:")}
  - steady-load        ${chalk.dim("Constant load over time")}
  - ramp-up-down       ${chalk.dim("Gradual increase and decrease")}
  - spike-load         ${chalk.dim("Sudden traffic spikes")}
  - endpoint-thinktime ${chalk.dim("Realistic user behavior with delays")}
  - variable-traffic   ${chalk.dim("Arrival rate that rises and falls")}

${chalk.bold("Examples:")}
  ${chalk.green("ltlab generate")}                           ${chalk.dim("Fully interactive mode")}
  ${chalk.green("ltlab generate -e k6 -n my-test")}         ${chalk.dim("Direct mode (all params)")}
  ${chalk.green("ltlab generate -e artillery -n api-test")}  ${chalk.dim("Create Artillery scenario")}

${chalk.bold("Output:")}
  k6:        ${chalk.cyan("k6/scenarios/<name>.js")}
  Artillery: ${chalk.cyan("artillery/scenarios/<name>.yml")}
`,
  )
  .action(generateCmd);

// Info / status
program
  .command("info")
  .description("Show current environment variables and lab status")
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Shows current .env configuration and running containers.
  Useful for troubleshooting and verifying setup.

${chalk.bold("Examples:")}
  ${chalk.green("ltlab info")}                   ${chalk.dim("Show configuration and status")}
`,
  )
  .action(showInfo);

// Operational commands
program
  .command("reset")
  .description("Reset all metrics in InfluxDB")
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Clears all metrics data from InfluxDB.
  ${chalk.red("Warning:")} This action cannot be undone!

${chalk.bold("Examples:")}
  ${chalk.green("ltlab reset")}                  ${chalk.dim("Clear all metrics")}

${chalk.bold("Use Cases:")}
  - Starting fresh test runs
  - Cleaning up after experiments
  - Removing old/invalid data
`,
  )
  .action(resetMetrics);

program
  .command("restart")
  .description("Restart services, recreating them with the current .env")
  .option(
    "-s, --service <service>",
    "Service to restart (influxdb, grafana, toy-api, telegraf, all)",
  )
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Recreates one service or all of them, so they start with the current
  .env, and waits until they are ready. Metrics stay on their volume.

${chalk.bold("Available Services:")}
  - influxdb  ${chalk.dim("Metrics database")}
  - grafana   ${chalk.dim("Dashboards")}
  - toy-api   ${chalk.dim("Test target API")}
  - telegraf  ${chalk.dim("Metrics collector for Artillery")}
  - all       ${chalk.dim("Restart all services")}

${chalk.bold("Examples:")}
  ${chalk.green("ltlab restart")}                ${chalk.dim("Interactive mode - choose service")}
  ${chalk.green("ltlab restart -s telegraf")}    ${chalk.dim("Restart Telegraf")}
  ${chalk.green("ltlab restart -s all")}         ${chalk.dim("Restart all services")}

${chalk.bold("Use Cases:")}
  - Apply a change to .env
  - Clear the toy API's in-memory job queue
  - Reset a specific service without stopping others
`,
  )
  .action(restartCmd);

program
  .command("rebuild")
  .description("Rebuild services with clean build (no cache)")
  .option(
    "-s, --service <service>",
    "Service to rebuild (k6, artillery, toy-api, all)",
  )
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Rebuilds Docker images from scratch without using cache.
  Useful when dependencies change or images are corrupted.

${chalk.bold("Available Services:")}
  - k6        ${chalk.dim("k6 load testing runner")}
  - artillery ${chalk.dim("Artillery load testing runner")}
  - toy-api   ${chalk.dim("Test target API")}
  - all       ${chalk.dim("Rebuild all services")}

${chalk.bold("Examples:")}
  ${chalk.green("ltlab rebuild")}                ${chalk.dim("Interactive mode - choose service")}
  ${chalk.green("ltlab rebuild -s k6")}          ${chalk.dim("Rebuild k6 image")}
  ${chalk.green("ltlab rebuild -s all")}         ${chalk.dim("Rebuild all images")}

${chalk.bold("Use Cases:")}
  - Updating dependencies
  - Fixing corrupted images
  - Applying Dockerfile changes
  - Fresh installation

${chalk.yellow("Note:")} Rebuild can take several minutes. The next test run uses the new
k6 or Artillery image, and a running toy API is recreated from its new image.
`,
  )
  .action(rebuildCmd);

program
  .command("purge")
  .description(
    "⚠️  Remove all containers, volumes, and data (requires confirmation)",
  )
  .addHelpText(
    "after",
    `
${chalk.red.bold("⚠️  DANGER ZONE ⚠️")}

${chalk.bold("Description:")}
  ${chalk.red("PERMANENTLY DELETES")} all lab data including:
  - All containers
  - All volumes (metrics, dashboards, etc.)
  - All networks
  - ${chalk.red.bold("ALL TEST DATA")}

${chalk.yellow("Safety Features:")}
  ✓ Double confirmation required
  ✓ Random code verification
  ✓ Cannot be undone

${chalk.bold("Examples:")}
  ${chalk.green("ltlab purge")}                  ${chalk.dim("Interactive purge with confirmations")}

${chalk.bold("Use Cases:")}
  - Complete lab reset
  - Starting from scratch
  - Removing all traces of lab
  - Freeing up disk space

${chalk.red.bold("⚠️  WARNING:")} This action cannot be undone. All metrics and test data will be lost.
`,
  )
  .action(purgeCmd);

program
  .command("k6")
  .description("Run k6 load tests")
  .option("-s, --scenario <file>", "Scenario file to run", "toy-fast.js")
  .option("-p, --project <dir>", "Mount entire project directory (for scenarios with helpers/data)")
  .option("-e, --env <vars...>", "Extra environment variables: KEY=value, or KEY to take the value from your shell")
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Executes a k6 test scenario in a Docker container.
  Results are sent to InfluxDB and visible in Grafana.
  Exits with k6's exit code: 99 when a threshold fails.

${chalk.bold("Examples:")}
  ${chalk.green("ltlab k6 -s my-test.js")}                        ${chalk.dim("Run specific k6 scenario")}
  ${chalk.green("ltlab k6 -s ./tests/api-test.js")}               ${chalk.dim("Run local file (auto-detected)")}
  ${chalk.green("ltlab k6 -p ./my-project -s main.js")}           ${chalk.dim("Mount project dir with helpers")}
  ${chalk.green("ltlab k6 -p ~/projects/api/tests -s flow.js")}   ${chalk.dim("External project with imports")}
  ${chalk.green("ltlab k6 -s ./tests/api-test.js -e API_TOKEN")}   ${chalk.dim("Pass API_TOKEN from your shell")}

${chalk.bold("Project Mode (-p):")}
  Use when your scenario imports other files (helpers, data, etc.)
  The entire directory is mounted at /project in the container.

  ${chalk.dim("Example structure:")}
    my-tests/
      main.js          ${chalk.dim("← scenario (imports helpers.js)")}
      helpers.js       ${chalk.dim("← shared functions")}
      data/users.json  ${chalk.dim("← test data")}

  ${chalk.dim("Run with:")} ltlab k6 -p ./my-tests -s main.js

${chalk.bold("Monitoring:")}
  View results in Grafana: ${chalk.cyan(`http://localhost:${process.env.GRAFANA_PORT || 3000}`)}
`,
  )
  .action(runK6);

program
  .command("artillery")
  .description("Run Artillery load tests")
  .option(
    "-s, --scenario <file>",
    "Scenario file to run",
    "toy-fast.yml",
  )
  .option("-p, --project <dir>", "Mount entire project directory (for scenarios with data files)")
  .option("-e, --env <vars...>", "Extra environment variables: KEY=value, or KEY to take the value from your shell")
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Executes an Artillery test scenario in a Docker container.
  Metrics are collected via Telegraf and stored in InfluxDB.
  Exits with Artillery's exit code.

${chalk.bold("Examples:")}
  ${chalk.green("ltlab artillery -s my-test.yml")}              ${chalk.dim("Run specific Artillery scenario")}
  ${chalk.green("ltlab artillery -s ./tests/load.yml")}         ${chalk.dim("Run local file (auto-detected)")}
  ${chalk.green("ltlab artillery -p ./my-tests -s main.yml")}   ${chalk.dim("Mount project dir with data")}

${chalk.bold("Project Mode (-p):")}
  Use when your scenario needs additional files (CSV data, configs, etc.)
  The entire directory is mounted at /project in the container.

${chalk.bold("Monitoring:")}
  View results in Grafana: ${chalk.cyan(`http://localhost:${process.env.GRAFANA_PORT || 3000}`)}
`,
  )
  .action(runArtillery);

program
  .command("run")
  .description("Run a scenario")
  .option("-e, --engine <engine>", "k6 or artillery")
  .option("-s, --scenario <file>", "Scenario file name")
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Interactive wizard that lets you choose engine and scenario.
  Simplifies running tests without remembering exact filenames.

${chalk.bold("Examples:")}
  ${chalk.green("ltlab run")}                    ${chalk.dim("Fully interactive mode")}
  ${chalk.green("ltlab run -e k6")}              ${chalk.dim("Pre-select k6, choose scenario")}
  ${chalk.green("ltlab run -e artillery -s test.yml")} ${chalk.dim("Run specific test")}
`,
  )
  .action(runCmd);

program
  .command("chaos")
  .description("🌪️  Run chaos engineering scenarios against toy-api")
  .option("-e, --engine <engine>", "Engine to use (k6 or artillery)")
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Runs chaos engineering tests against the toy API with realistic failure patterns.
  They always target the toy API, whatever TARGET_API_URL says.
  ${chalk.green("Perfect for:")} Tutorials, demos, dashboard testing, and learning load testing!
  ${chalk.yellow("No external APIs needed")} - everything runs locally with toy-api.

${chalk.bold("Chaos Scenarios:")}
  ${chalk.yellow("• Basic")}      - Mixed chaos: random errors, latency, CPU load
  ${chalk.red("• Spike")}      - Traffic spike with simultaneous failures
  ${chalk.green("• Resilience")} - Test retry logic and error recovery

${chalk.bold("Examples:")}
  ${chalk.green("ltlab chaos")}                  ${chalk.dim("Interactive mode - choose engine and scenario")}
  ${chalk.green("ltlab chaos -e k6")}            ${chalk.dim("Use k6, then select scenario")}
  ${chalk.green("ltlab chaos -e artillery")}     ${chalk.dim("Use Artillery, then select scenario")}

${chalk.bold("What You'll Learn:")}
  • How to interpret error rates in dashboards
  • Response time patterns under stress
  • Difference between p50, p95, p99 metrics
  • Recovery time after failures
  • How to identify bottlenecks visually

${chalk.bold("Use Cases:")}
  ✓ Teaching load testing to beginners
  ✓ Testing dashboard configurations
  ✓ Demo scenarios without real APIs
  ✓ Understanding chaos engineering
  ✓ Practicing metric interpretation
`,
  )
  .action(chaosTest);

program
  .command("metrics")
  .description("Show historical metrics from InfluxDB")
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Shows InfluxDB buckets and basic metrics information.
  For detailed metrics, use Grafana dashboards.

${chalk.bold("Examples:")}
  ${chalk.green("ltlab metrics")}                ${chalk.dim("Show metrics info")}

${chalk.bold("Better Alternative:")}
  Open Grafana: ${chalk.cyan(`http://localhost:${process.env.GRAFANA_PORT || 3000}`)}
`,
  )
  .action(showMetrics);

// Dashboard management
program
  .command("dashboard [action] [source]")
  .description("Manage custom Grafana dashboards")
  .addHelpText(
    "after",
    `
${chalk.bold("Description:")}
  Brings a project's Grafana dashboards into the lab, so they can live in
  the project's repository. Grafana rescans its dashboards every 10
  seconds, so changes show up without a restart.

${chalk.bold("Actions:")}
  link <dir>    Copy the dashboard JSON files at the top of <dir> into the lab
                (replacing the previously linked ones); run again to sync
  list          List current dashboards
  unlink        Remove the linked dashboards

${chalk.bold("Examples:")}
  ${chalk.green("ltlab dashboard link ~/projects/my-api/dashboards")}   ${chalk.dim("Link external dashboards")}
  ${chalk.green("ltlab dashboard list")}                                 ${chalk.dim("List all dashboards")}
  ${chalk.green("ltlab dashboard unlink")}                               ${chalk.dim("Remove linked dashboards")}

${chalk.bold("Dashboard Format:")}
  A dashboard's JSON model (Dashboard settings > JSON Model in Grafana).
`,
  )
  .action(dashboardCmd);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.help();
}

// Handle graceful exit on Ctrl+C during prompts
process.on("uncaughtException", (error) => {
  if (error.name === "ExitPromptError" || error.message?.includes("SIGINT")) {
    console.log(chalk.dim("\n\n👋 Cancelled by user"));
    process.exit(0);
  }
  // Re-throw other errors
  throw error;
});

program.parse();
