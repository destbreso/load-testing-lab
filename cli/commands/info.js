import chalk from "chalk";
import { compose, readLabEnv, ENV_PATH } from "../lib/lab.js";

export default async function showInfo() {
  console.log(chalk.cyan.bold("\n📊 Load Testing Lab - Environment Info\n"));

  // Parse the lab's .env file
  const envConfig = readLabEnv();
  if (envConfig) {
    console.log(chalk.green(`✓ .env file found (${ENV_PATH})\n`));

    // Display environment variables in organized sections
    console.log(chalk.white.bold("🔧 Configuration:\n"));

    // InfluxDB section
    if (
      envConfig.INFLUXDB_URL ||
      envConfig.INFLUXDB_TOKEN ||
      envConfig.INFLUXDB_ORG
    ) {
      console.log(chalk.cyan("  📦 InfluxDB:"));
      const influxUrl =
        envConfig.INFLUXDB_URL || `http://localhost:${envConfig.INFLUXDB_PORT_EXPORT || 8086}`;
      console.log(chalk.dim(`     URL:    ${influxUrl}`));
      if (envConfig.INFLUXDB_ORG) {
        console.log(chalk.dim(`     Org:    ${envConfig.INFLUXDB_ORG}`));
      }
      if (envConfig.INFLUXDB_TOKEN) {
        const maskedToken = envConfig.INFLUXDB_TOKEN.substring(0, 6) + "...";
        console.log(chalk.dim(`     Token:  ${maskedToken}`));
      }
      if (envConfig.INFLUXDB_BUCKET) {
        console.log(chalk.dim(`     Bucket: ${envConfig.INFLUXDB_BUCKET}`));
      }
      if (envConfig.INFLUXDB_USER) {
        console.log(chalk.dim(`     User:   ${envConfig.INFLUXDB_USER}`));
      }
      if (envConfig.INFLUXDB_PASSWORD) {
        console.log(chalk.dim(`     Password: ***${envConfig.INFLUXDB_PASSWORD.slice(-3)}`));
      }
      console.log();
    }

    // Grafana section
    if (
      envConfig.GRAFANA_PORT ||
      envConfig.GRAFANA_USER ||
      envConfig.GRAFANA_PASSWORD
    ) {
      console.log(chalk.cyan("  📈 Grafana:"));
      if (envConfig.GRAFANA_PORT) {
        console.log(chalk.dim(`     Port:     ${envConfig.GRAFANA_PORT}`));
        console.log(
          chalk.dim(
            `     URL:      http://localhost:${envConfig.GRAFANA_PORT}`,
          ),
        );
      }
      if (envConfig.GRAFANA_USER) {
        console.log(chalk.dim(`     User:     ${envConfig.GRAFANA_USER}`));
      }
      if (envConfig.GRAFANA_PASSWORD) {
        const maskedPass =
          "***" +
          envConfig.GRAFANA_PASSWORD.substring(
            envConfig.GRAFANA_PASSWORD.length - 3,
          );
        console.log(chalk.dim(`     Password: ${maskedPass}`));
      }
      console.log();
    }

    // Target API section
    if (envConfig.TARGET_API_URL) {
      console.log(chalk.cyan("  🎯 Target API:"));
      console.log(chalk.dim(`     URL: ${envConfig.TARGET_API_URL}`));
      console.log();
    }

    // Test configuration
    if (envConfig.CONCURRENCY || envConfig.DURATION) {
      console.log(chalk.cyan("  ⚡ Test Defaults:"));
      if (envConfig.CONCURRENCY) {
        console.log(
          chalk.dim(`     Concurrency: ${envConfig.CONCURRENCY} VUs`),
        );
      }
      if (envConfig.DURATION) {
        console.log(chalk.dim(`     Duration:    ${envConfig.DURATION}`));
      }
      console.log();
    }

    // Other variables
    const displayedKeys = [
      "INFLUXDB_URL",
      "INFLUXDB_TOKEN",
      "INFLUXDB_ORG",
      "INFLUXDB_BUCKET",
      "INFLUXDB_USER",
      "INFLUXDB_PASSWORD",
      "GRAFANA_PORT",
      "GRAFANA_USER",
      "GRAFANA_PASSWORD",
      "TARGET_API_URL",
      "CONCURRENCY",
      "DURATION",
    ];

    const otherVars = Object.entries(envConfig).filter(
      ([key]) => !displayedKeys.includes(key),
    );

    if (otherVars.length > 0) {
      console.log(chalk.cyan("  🔹 Other Variables:"));
      otherVars.forEach(([key, value]) => {
        const displayValue =
          value.length > 50 ? value.substring(0, 47) + "..." : value;
        console.log(chalk.dim(`     ${key}: ${displayValue}`));
      });
      console.log();
    }
  } else {
    console.log(chalk.red("❌ .env file not found!\n"));
    console.log(chalk.yellow("💡 Create one with:"));
    console.log(chalk.cyan("   ltlab configure\n"));
  }

  // Lab Services Status
  console.log(chalk.white.bold("🐳 Docker Services Status:\n"));

  try {
    const { stdout } = await compose(["ps", "--format", "json"], { stdio: "pipe" });
    const text = stdout.trim();
    // Compose prints one JSON object per line (or, in older v2 releases, one array)
    const services = !text ? [] : text.startsWith("[") ? JSON.parse(text) : text.split("\n").map((line) => JSON.parse(line));

    if (services.length === 0) {
      console.log(chalk.yellow("  ⚠️  No services running\n"));
      console.log(chalk.dim("     Start the lab with: ltlab start\n"));
    } else {
      services.forEach((service) => {
        const name = service.Service || service.Name;
        const state = service.State;
        const health = service.Health;
        const statusColor = state === "running" ? (health && health !== "healthy" ? chalk.yellow : chalk.green) : chalk.red;
        console.log(statusColor(`  ● ${name}`));
        console.log(chalk.dim(`     State:  ${state}${health ? ` (${health})` : ""}`));
        if (service.Status) console.log(chalk.dim(`     Status: ${service.Status}`));
        console.log();
      });
    }
  } catch (err) {
    console.log(chalk.red("  ❌ Failed to get services status\n"));
    console.log(chalk.yellow("     Possible issues:"));
    console.log(chalk.dim("     • Docker is not running"));
    console.log(chalk.dim(`     • ${err.shortMessage || err.message}\n`));
  }

  // Quick Links
  console.log(chalk.white.bold("🔗 Quick Links:\n"));
  const grafanaPort = process.env.GRAFANA_PORT || 3000;
  const influxPort = process.env.INFLUXDB_PORT_EXPORT || 8086;
  const toyApiPort = process.env.TOY_API_PORT || 5000;
  console.log(chalk.cyan(`  • Grafana:  http://localhost:${grafanaPort}`));
  console.log(chalk.cyan(`  • InfluxDB: http://localhost:${influxPort}`));
  console.log(chalk.cyan(`  • Toy API:  http://localhost:${toyApiPort}`));
  console.log();
}
