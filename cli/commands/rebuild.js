import { spawn } from "child_process";
import inquirer from "inquirer";
import chalk from "chalk";

const SERVICES = [
  { name: "All services", value: "all" },
  { name: "k6 (load testing runner)", value: "k6" },
  { name: "Artillery (load testing runner)", value: "artillery" },
  { name: "Toy API (test target)", value: "toy-api" },
];

export default async function rebuildCmd(options) {
  let { service } = options;

  // If service not provided, show interactive selector
  if (!service) {
    const answer = await inquirer.prompt([
      {
        type: "select",
        name: "service",
        message: "Select service to rebuild:",
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
    args = ["build", "--no-cache"];
    displayName = "all services";
  } else {
    args = ["build", "--no-cache", service];
    displayName = service;
  }

  console.log(chalk.blue(`\n▶ Rebuilding ${displayName} (clean build - no cache)...`));
  console.log(chalk.dim(`  Command: ${cmd} ${args.join(" ")}\n`));
  console.log(chalk.yellow("⚠️  This may take several minutes...\n"));

  const child = spawn(cmd, args, { stdio: "inherit", shell: true });

  child.on("exit", (code) => {
    if (code === 0) {
      console.log(chalk.green(`\n✓ ${displayName} rebuilt successfully!`));
      console.log(chalk.cyan(`\nNext steps:`));
      console.log(chalk.dim(`  1. Stop services: ${chalk.green("ltlab stop")}`));
      console.log(chalk.dim(`  2. Start services: ${chalk.green("ltlab start")}`));
    } else {
      console.log(chalk.red(`\n✗ Rebuild failed with exit code ${code}`));
    }
    process.exit(code);
  });
}
