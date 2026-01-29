import { execa } from "execa";
import chalk from "chalk";
import fs from "fs";
import path from "path";

export default async function startLab() {
  try {
    console.log(chalk.blue("Starting Load Testing Lab..."));
    await execa("docker-compose", ["up", "-d"], { stdio: "inherit" });

    console.log(chalk.green("\n✅ Lab started successfully!"));

    const grafanaPort = process.env.GRAFANA_PORT || 3000;
    console.log(
      chalk.yellow(`Access Grafana at http://localhost:${grafanaPort}`),
    );
    const toyApiPort = process.env.TOY_API_PORT;
    if (toyApiPort) {
      console.log(
        chalk.yellow(`Toy API running at http://localhost:${toyApiPort}`),
      );
    }
    console.log(chalk.cyan("──────────────────────────\n"));

    console.log(chalk.cyan("▶ Next Steps:"));
    console.log(chalk.cyan("──────────────────────────"));

    // Detect k6 scenarios
    const k6Dir = path.join(process.cwd(), "k6", "scenarios");
    let k6Scenarios = [];
    if (fs.existsSync(k6Dir)) {
      k6Scenarios = fs
        .readdirSync(k6Dir)
        .filter((file) => file.endsWith(".js"));
    }

    if (k6Scenarios.length) {
      console.log(chalk.magenta("▶ k6 scenarios:"));
      k6Scenarios.forEach((scenario) => {
        console.log(
          `   ${chalk.white(`npm run cli run -e k6 -s ${scenario}`)}`,
        );
      });
      console.log("");
    }

    // Detect Artillery scenarios
    const artilleryDir = path.join(process.cwd(), "artillery", "scenarios");
    let artilleryScenarios = [];
    if (fs.existsSync(artilleryDir)) {
      artilleryScenarios = fs
        .readdirSync(artilleryDir)
        .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));
    }

    if (artilleryScenarios.length) {
      console.log(chalk.magenta("▶ Artillery scenarios:"));
      artilleryScenarios.forEach((scenario) => {
        console.log(
          `   ${chalk.white(`npm run cli run -e artillery -s ${scenario}`)}`,
        );
      });
      console.log("");
    }

    // Detect blueprints
    const blueprintsDir = path.join(process.cwd(), "blueprints");
    if (fs.existsSync(blueprintsDir)) {
      const blueprints = fs
        .readdirSync(blueprintsDir)
        .filter(
          (file) =>
            file.endsWith(".js") ||
            file.endsWith(".yml") ||
            file.endsWith(".yaml"),
        );
      if (blueprints.length) {
        console.log(chalk.magenta("▶ Available blueprints for generation:"));
        blueprints.forEach((bp) => {
          console.log(`   ${chalk.white(`npm run cli generate -b ${bp}`)}`);
        });
        console.log("");
      }
    }

    console.log(chalk.magenta("▶ View metrics in Grafana:"));
    console.log(`   ${chalk.white(`http://localhost:${grafanaPort}`)}\n`);

    console.log(chalk.magenta("▶ Other commands:"));
    console.log(`   ${chalk.white("npm run cli info")}        # Show info`);
    console.log(
      `   ${chalk.white("npm run cli configure")}   # Configure lab environment`,
    );
    console.log(`   ${chalk.white("npm run cli reset")}       # Reset metrics`);
    console.log(
      `   ${chalk.white("npm run cli stop")}        # Stop the lab\n`,
    );

    console.log(
      chalk.green("You’re ready to start load testing your APIs! 🚀\n"),
    );
  } catch (err) {
    console.error(chalk.red("❌ Failed to start lab:"), err.message);
  }
}
