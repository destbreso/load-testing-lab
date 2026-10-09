import { execa } from "execa";
import chalk from "chalk";
import inquirer from "inquirer";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

// Obtener directorio del proyecto
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

export default async function resetMetrics() {
  console.log(chalk.yellow.bold("\n⚠️  Reset All Metrics\n"));
  console.log(chalk.white("This will delete all metrics data from InfluxDB."));
  console.log(chalk.dim("Every bucket except InfluxDB's own system buckets\n"));

  // Confirmation
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Are you sure you want to delete all metrics?",
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow("\n⚠️  Reset cancelled.\n"));
    return;
  }

  console.log(chalk.blue("\n🗑️  Resetting metrics...\n"));

  try {
    const scriptPath = path.join(projectRoot, "scripts", "reset-metrics.js");
    await execa("node", [scriptPath], { stdio: "inherit", cwd: projectRoot });
    console.log(chalk.green("\n✅ Metrics reset successfully!\n"));
  } catch (err) {
    console.error(chalk.red("\n❌ Failed to reset metrics\n"));
    console.log(chalk.yellow("Possible issues:"));
    console.log(chalk.dim("  • InfluxDB is not running (try: ltlab start)"));
    console.log(chalk.dim("  • Invalid InfluxDB credentials in .env"));
    console.log(chalk.dim("  • Network connectivity issues"));
    console.log(chalk.dim("\n💡 Run 'ltlab info' to check service status\n"));
    process.exit(1);
  }
}
