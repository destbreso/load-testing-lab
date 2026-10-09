import inquirer from "inquirer";
import chalk from "chalk";
import { compose, composeDisplay, exitCodeOf } from "../lib/lab.js";

const SERVICES = [
  { name: "All services", value: "all" },
  { name: "k6 (load testing runner)", value: "k6" },
  { name: "Artillery (load testing runner)", value: "artillery" },
  { name: "Toy API (test target)", value: "toy-api" },
];

export default async function rebuildCmd(options) {
  let { service } = options;

  if (!service) {
    const answer = await inquirer.prompt([
      { type: "select", name: "service", message: "Select service to rebuild:", choices: SERVICES },
    ]);
    service = answer.service;
  }

  if (!SERVICES.some((s) => s.value === service)) {
    console.error(chalk.red(`Unknown service: ${service}`));
    console.log(chalk.yellow(`Choose one of: ${SERVICES.map((s) => s.value).join(", ")}`));
    process.exitCode = 1;
    return;
  }

  const services = service === "all" ? ["k6", "artillery", "toy-api"] : [service];
  const args = ["build", "--no-cache", ...services];

  console.log(chalk.blue(`\n▶ Rebuilding ${services.join(", ")} (clean build, no cache)...`));
  console.log(chalk.dim(`  Command: ${await composeDisplay(args)}\n`));
  console.log(chalk.yellow("⚠️  This may take several minutes...\n"));

  try {
    await compose(args);

    // The runners use the new image on their next run; a running toy API is
    // recreated from its new image now
    if (services.includes("toy-api")) {
      const { stdout } = await compose(["ps", "-q", "toy-api"], { stdio: "pipe" });
      if (stdout.trim()) {
        console.log(chalk.blue("\n▶ Recreating the running toy API from the new image..."));
        await compose(["up", "-d", "--no-deps", "--wait", "toy-api"]);
      }
    }
    console.log(chalk.green(`\n✓ ${services.join(", ")} rebuilt.`));
  } catch (err) {
    console.log(chalk.red(`\n✗ Rebuild failed with exit code ${exitCodeOf(err)}`));
    process.exitCode = exitCodeOf(err);
  }
}
