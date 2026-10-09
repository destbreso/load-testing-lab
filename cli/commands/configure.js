import fs from "fs";
import crypto from "crypto";
import inquirer from "inquirer";
import chalk from "chalk";
import { ENV_PATH, readLabEnv } from "../lib/lab.js";

// The keys configure writes, in this order; any other key already in .env
// (ports, project-specific variables) is kept below them.
const KEYS = [
  "TARGET_API_URL",
  "INFLUXDB_URL",
  "INFLUXDB_TOKEN",
  "INFLUXDB_ORG",
  "INFLUXDB_BUCKET",
  "INFLUXDB_USER",
  "INFLUXDB_PASSWORD",
  "GRAFANA_USER",
  "GRAFANA_PASSWORD",
  "CONCURRENCY",
  "DURATION",
];

export function renderEnv(values, current = {}) {
  const lines = KEYS.map((key) => `${key}=${values[key]}`);
  for (const [key, value] of Object.entries(current)) {
    if (!KEYS.includes(key)) lines.push(`${key}=${value}`);
  }
  return lines.join("\n") + "\n";
}

// INFLUXDB_URL is for the scripts that run on your machine (reset, metrics),
// so it points at the port InfluxDB publishes. Older versions of this command
// suggested the container-only address http://influxdb:8086, which does not
// resolve outside Docker; that value is replaced.
function hostInfluxUrl(current) {
  const url = current.INFLUXDB_URL;
  if (url && !/\/\/influxdb[:/]/.test(url)) return url;
  return `http://localhost:${current.INFLUXDB_PORT_EXPORT || 8086}`;
}

export default async function configureEnv() {
  try {
    console.log(chalk.blue(`Configure your Load Testing Lab environment (${ENV_PATH})`));
    const current = readLabEnv() || {};

    const answers = await inquirer.prompt([
      {
        name: "TARGET_API_URL",
        message: "API URL to test, as the containers see it (http://toy-api:5000 is the lab's toy API)",
        default: current.TARGET_API_URL || "http://toy-api:5000",
      },
      { name: "INFLUXDB_ORG", message: "InfluxDB organization", default: current.INFLUXDB_ORG || "myorg" },
      { name: "INFLUXDB_BUCKET", message: "InfluxDB bucket", default: current.INFLUXDB_BUCKET || "loadtests" },
      { name: "INFLUXDB_USER", message: "InfluxDB admin user", default: current.INFLUXDB_USER || "admin" },
      {
        name: "INFLUXDB_PASSWORD",
        message: "InfluxDB admin password (at least 8 characters)",
        default: current.INFLUXDB_PASSWORD || "admin123",
        validate: (v) => v.length >= 8 || "InfluxDB requires at least 8 characters",
      },
      { name: "GRAFANA_USER", message: "Grafana admin user", default: current.GRAFANA_USER || "admin" },
      { name: "GRAFANA_PASSWORD", message: "Grafana admin password", default: current.GRAFANA_PASSWORD || "admin123" },
      { name: "CONCURRENCY", message: "Virtual users for toy-fast.js", default: current.CONCURRENCY || "50" },
      { name: "DURATION", message: "Duration of toy-fast.js", default: current.DURATION || "60s" },
    ]);

    const keptToken = Boolean(current.INFLUXDB_TOKEN);
    const values = {
      ...answers,
      INFLUXDB_URL: hostInfluxUrl(current),
      // InfluxDB adopts this token as its admin token on its first start, and
      // k6, Telegraf and Grafana read the same value from here
      INFLUXDB_TOKEN: current.INFLUXDB_TOKEN || crypto.randomBytes(32).toString("hex"),
    };

    fs.writeFileSync(ENV_PATH, renderEnv(values, current), { mode: 0o600 });
    console.log(chalk.green(".env file created/updated successfully!"));
    console.log(
      chalk.dim(
        keptToken
          ? "Kept the existing InfluxDB token."
          : "Generated an InfluxDB token. InfluxDB adopts it on its first start, and k6, Telegraf and Grafana use the same one.",
      ),
    );
    console.log(chalk.dim("Changes reach running services with: ltlab restart -s all"));
  } catch (err) {
    console.error(chalk.red("Failed to configure environment:"), err.message);
    process.exitCode = 1;
  }
}
