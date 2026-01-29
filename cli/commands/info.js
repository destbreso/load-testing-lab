import chalk from "chalk";
import { execa } from "execa";
import fs from "fs";
import dotenv from "dotenv";

export default async function showInfo() {
  console.log(chalk.cyan.bold("\n📊 Load Testing Lab - Environment Info\n"));

  // Parse .env file
  if (fs.existsSync(".env")) {
    console.log(chalk.green("✓ .env file found\n"));

    const envConfig = dotenv.parse(fs.readFileSync(".env", "utf8"));

    // Display environment variables in organized sections
    console.log(chalk.white.bold("🔧 Configuration:\n"));

    // InfluxDB section
    if (
      envConfig.INFLUXDB_URL ||
      envConfig.INFLUXDB_TOKEN ||
      envConfig.INFLUXDB_ORG
    ) {
      console.log(chalk.cyan("  📦 InfluxDB:"));
      if (envConfig.INFLUXDB_URL) {
        console.log(chalk.dim(`     URL:    ${envConfig.INFLUXDB_URL}`));
      }
      if (envConfig.INFLUXDB_ORG) {
        console.log(chalk.dim(`     Org:    ${envConfig.INFLUXDB_ORG}`));
      }
      if (envConfig.INFLUXDB_TOKEN) {
        const maskedToken = envConfig.INFLUXDB_TOKEN.substring(0, 10) + "...";
        console.log(chalk.dim(`     Token:  ${maskedToken}`));
      }
      if (envConfig.INFLUXDB_BUCKET) {
        console.log(chalk.dim(`     Bucket: ${envConfig.INFLUXDB_BUCKET}`));
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
    const { stdout } = await execa("docker-compose", [
      "ps",
      "--format",
      "json",
    ]);

    if (stdout.trim()) {
      const services = stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      if (services.length === 0) {
        console.log(chalk.yellow("  ⚠️  No services running\n"));
        console.log(chalk.dim("     Start the lab with: ltlab start\n"));
      } else {
        services.forEach((service) => {
          const name = service.Service || service.Name;
          const state = service.State;
          const status = service.Status;

          let statusIcon = "●";
          let statusColor = chalk.gray;

          if (state === "running") {
            statusIcon = "●";
            statusColor = chalk.green;
          } else if (state === "exited") {
            statusIcon = "○";
            statusColor = chalk.red;
          } else {
            statusIcon = "◐";
            statusColor = chalk.yellow;
          }

          console.log(statusColor(`  ${statusIcon} ${name}`));
          console.log(chalk.dim(`     State:  ${state}`));
          if (status) {
            console.log(chalk.dim(`     Status: ${status}`));
          }
          console.log();
        });
      }
    } else {
      console.log(chalk.yellow("  ⚠️  No services running\n"));
      console.log(chalk.dim("     Start the lab with: ltlab start\n"));
    }
  } catch (err) {
    // Fallback to simple ps if JSON format not available
    console.log(chalk.dim("  Checking services...\n"));
    try {
      const { stdout } = await execa("docker-compose", ["ps"]);

      if (stdout.includes("No containers found")) {
        console.log(chalk.yellow("  ⚠️  No services running\n"));
        console.log(chalk.dim("     Start the lab with: ltlab start\n"));
      } else {
        // Parse simple output
        const lines = stdout
          .split("\n")
          .filter((line) => line.trim() && !line.startsWith("NAME"));

        if (lines.length === 0) {
          console.log(chalk.yellow("  ⚠️  No services running\n"));
          console.log(chalk.dim("     Start the lab with: ltlab start\n"));
        } else {
          lines.forEach((line) => {
            const parts = line.trim().split(/\s+/);
            if (parts.length > 0) {
              const name = parts[0];
              const status = parts.slice(1).join(" ");

              let statusIcon = "●";
              let statusColor = chalk.gray;

              if (status.includes("Up") || status.includes("running")) {
                statusIcon = "●";
                statusColor = chalk.green;
              } else if (status.includes("Exit")) {
                statusIcon = "○";
                statusColor = chalk.red;
              }

              console.log(statusColor(`  ${statusIcon} ${name}`));
              console.log(chalk.dim(`     ${status}`));
              console.log();
            }
          });
        }
      }
    } catch (innerErr) {
      console.log(chalk.red("  ❌ Failed to get services status\n"));
      console.log(chalk.yellow("     Possible issues:"));
      console.log(chalk.dim("     • Docker is not running"));
      console.log(chalk.dim("     • docker-compose is not installed"));
      console.log(chalk.dim("     • Not in project directory\n"));
    }
  }

  // Quick Links
  console.log(chalk.white.bold("🔗 Quick Links:\n"));
  const grafanaPort = process.env.GRAFANA_PORT || 3000;
  const influxPort = process.env.INFLUXDB_PORT || 8086;
  console.log(chalk.cyan(`  • Grafana:  http://localhost:${grafanaPort}`));
  console.log(chalk.cyan(`  • InfluxDB: http://localhost:${influxPort}`));
  console.log(chalk.cyan(`  • Toy API:  http://localhost:5000`));
  console.log();
}
