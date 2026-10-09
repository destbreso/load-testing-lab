import chalk from "chalk";
import { compose, exitCodeOf } from "../lib/lab.js";

export default async function stopLab() {
  try {
    console.log(chalk.blue("Stopping Load Testing Lab..."));
    await compose(["down", "--remove-orphans"]);
    console.log(chalk.green("Lab stopped. Metrics and the InfluxDB setup stay on their volume."));
  } catch (err) {
    console.error(chalk.red("Failed to stop lab:"), err.shortMessage || err.message);
    process.exitCode = exitCodeOf(err);
  }
}
