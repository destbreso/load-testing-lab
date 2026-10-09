import chalk from "chalk";
import fs from "fs";
import path from "path";
import { LAB_ROOT, readLabEnv, compose, exitCodeOf } from "../lib/lab.js";

function listScenarios(engine, extensions) {
  const dir = path.join(LAB_ROOT, engine, "scenarios");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => extensions.some((ext) => f.endsWith(ext)));
}

export default async function startLab() {
  const env = readLabEnv();
  if (!env || !env.INFLUXDB_TOKEN) {
    console.error(chalk.red(env ? "INFLUXDB_TOKEN is missing from .env." : "There is no .env file yet."));
    console.log(chalk.yellow("Create it with: ") + chalk.green("ltlab configure"));
    process.exitCode = 1;
    return;
  }

  try {
    console.log(chalk.blue("Building the k6 and Artillery images (the first build takes a few minutes)..."));
    await compose(["build", "k6", "artillery"]);
    console.log(chalk.blue("\nStarting the Load Testing Lab and waiting until every service is ready..."));
    await compose(["up", "-d", "--wait"]);
  } catch (err) {
    console.error(chalk.red("\n❌ Failed to start the lab:"), err.shortMessage || err.message);
    process.exitCode = exitCodeOf(err);
    return;
  }

  const grafanaPort = process.env.GRAFANA_PORT || 3000;
  const toyApiPort = process.env.TOY_API_PORT || 5000;
  const influxPort = process.env.INFLUXDB_PORT_EXPORT || 8086;

  console.log(chalk.green("\n✅ Lab started, every service is ready."));
  console.log(chalk.yellow(`   Grafana:  http://localhost:${grafanaPort}`));
  console.log(chalk.yellow(`   InfluxDB: http://localhost:${influxPort}`));
  console.log(chalk.yellow(`   Toy API:  http://localhost:${toyApiPort}`));

  console.log(chalk.cyan("\n▶ Run a test:"));
  console.log(`   ${chalk.white("ltlab k6 -s toy-fast.js")}`);
  console.log(`   ${chalk.white("ltlab artillery -s toy-fast.yml")}`);

  const k6Scenarios = listScenarios("k6", [".js"]);
  if (k6Scenarios.length) {
    console.log(chalk.magenta(`\n▶ Built-in k6 scenarios: `) + chalk.white(k6Scenarios.join(", ")));
  }
  const artilleryScenarios = listScenarios("artillery", [".yml", ".yaml"]);
  if (artilleryScenarios.length) {
    console.log(chalk.magenta(`▶ Built-in Artillery scenarios: `) + chalk.white(artilleryScenarios.join(", ")));
  }

  console.log(chalk.cyan("\n▶ Other commands:"));
  console.log(`   ${chalk.white("ltlab generate")}   # new scenario from a blueprint`);
  console.log(`   ${chalk.white("ltlab info")}       # configuration and service status`);
  console.log(`   ${chalk.white("ltlab reset")}      # delete stored metrics`);
  console.log(`   ${chalk.white("ltlab stop")}       # stop the lab\n`);
}
