import inquirer from "inquirer";
import chalk from "chalk";
import { compose, composeDisplay, exitCodeOf } from "../lib/lab.js";

const SERVICES = [
  { name: "All services", value: "all" },
  { name: "InfluxDB (metrics database)", value: "influxdb" },
  { name: "Grafana (dashboards)", value: "grafana" },
  { name: "Toy API (test target)", value: "toy-api" },
  { name: "Telegraf (metrics collector)", value: "telegraf" },
];

// Restarting recreates the containers, so they pick up any change to .env
export default async function restartCmd(options) {
  let { service } = options;

  if (!service) {
    const answer = await inquirer.prompt([
      { type: "select", name: "service", message: "Select service to restart:", choices: SERVICES },
    ]);
    service = answer.service;
  }

  if (!SERVICES.some((s) => s.value === service)) {
    console.error(chalk.red(`Unknown service: ${service}`));
    console.log(chalk.yellow(`Choose one of: ${SERVICES.map((s) => s.value).join(", ")}`));
    process.exitCode = 1;
    return;
  }

  const args =
    service === "all"
      ? ["up", "-d", "--force-recreate", "--wait"]
      : ["up", "-d", "--force-recreate", "--no-deps", "--wait", service];
  const displayName = service === "all" ? "all services" : service;

  console.log(chalk.blue(`\n▶ Restarting ${displayName}...`));
  console.log(chalk.dim(`  Command: ${await composeDisplay(args)}\n`));

  try {
    await compose(args);
    console.log(chalk.green(`\n✓ ${displayName} restarted, with the current .env.`));
    if (service === "grafana" || service === "all") {
      console.log(chalk.cyan(`  Grafana: http://localhost:${process.env.GRAFANA_PORT || 3000}`));
    }
    if (service === "influxdb" || service === "all") {
      console.log(chalk.cyan(`  InfluxDB: http://localhost:${process.env.INFLUXDB_PORT_EXPORT || 8086}`));
    }
  } catch (err) {
    console.log(chalk.red(`\n✗ Restart failed with exit code ${exitCodeOf(err)}`));
    process.exitCode = exitCodeOf(err);
  }
}
