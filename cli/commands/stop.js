import { execa } from "execa";
import chalk from "chalk";

export default async function stopLab() {
  try {
    console.log(chalk.blue("Stopping Load Testing Lab..."));
    await execa("docker-compose", ["down"], { stdio: "inherit" });
    console.log(chalk.green("Lab stopped successfully!"));
  } catch (err) {
    console.error(chalk.red("Failed to stop lab:"), err.message);
  }
}
