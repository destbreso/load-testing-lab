import { spawn } from "child_process";
import inquirer from "inquirer";
import chalk from "chalk";

const SERVICES = [
  { name: "All services", value: "all" },
  { name: "InfluxDB (metrics database)", value: "influxdb" },
  { name: "Grafana (dashboards)", value: "grafana" },
  { name: "Toy API (test target)", value: "toy-api" },
  { name: "Telegraf (metrics collector)", value: "telegraf" },
];

export default async function restartCmd(options) {
  let { service } = options;

  // If service not provided, show interactive selector
  if (!service) {
    const answer = await inquirer.prompt([
      {
        type: "select",
        name: "service",
        message: "Select service to restart:",
        choices: SERVICES,
      },
    ]);
    service = answer.service;
  }

  // Determine which command to execute
  const cmd = "docker-compose";
  let args;
  let displayName;

  if (service === "all") {
    args = ["restart"];
    displayName = "all services";
  } else {
    args = ["restart", service];
    displayName = service;
  }

  console.log(chalk.blue(`\n▶ Restarting ${displayName}...`));
  console.log(chalk.dim(`  Command: ${cmd} ${args.join(" ")}\n`));

  const child = spawn(cmd, args, { stdio: "inherit", shell: true });

  child.on("exit", (code) => {
    if (code === 0) {
      console.log(chalk.green(`\n✓ ${displayName} restarted successfully!`));
      
      if (service === "grafana" || service === "all") {
        console.log(chalk.cyan(`  Grafana: http://localhost:3000`));
        console.log(chalk.dim(`  Dashboards will be provisioned automatically`));
      }
      if (service === "influxdb" || service === "all") {
        console.log(chalk.cyan(`  InfluxDB: http://localhost:8086`));
      }
    } else {
      console.log(chalk.red(`\n✗ Restart failed with exit code ${code}`));
    }
    process.exit(code);
  });
}
