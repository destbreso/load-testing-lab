import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import inquirer from "inquirer";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get project directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

export default async function runCmd(options) {
  let { engine, scenario } = options;

  // Step 1: Select engine if not provided
  if (!engine) {
    const engineAnswer = await inquirer.prompt([
      {
        type: "select",
        name: "engine",
        message: "Select the engine to use:",
        choices: [
          { name: "k6 (JavaScript-based load testing)", value: "k6" },
          { name: "Artillery (YAML-based load testing)", value: "artillery" },
        ],
      },
    ]);
    engine = engineAnswer.engine;
  }

  // Validate engine
  if (!["k6", "artillery"].includes(engine)) {
    console.error(chalk.red('Engine must be "k6" or "artillery"'));
    process.exit(1);
  }

  // Scenarios folder (use absolute path to project)
  const scenariosDir = path.join(projectRoot, engine, "scenarios");

  if (!fs.existsSync(scenariosDir)) {
    console.error(
      chalk.red(`No scenarios folder found for ${engine} at ${scenariosDir}`),
    );
    console.log(
      chalk.yellow(
        `\nTip: Generate a scenario first with: ${chalk.green(`npm run cli -- generate -e ${engine} -n my-test`)}`,
      ),
    );
    process.exit(1);
  }

  // Listar escenarios
  const files = fs
    .readdirSync(scenariosDir)
    .filter((f) => f.endsWith(engine === "k6" ? ".js" : ".yml"));

  if (files.length === 0) {
    console.error(chalk.red(`\nNo scenarios found for ${engine}`));
    console.log(
      chalk.yellow(
        `\nTip: Generate a scenario first with: ${chalk.green(`npm run cli -- generate -e ${engine} -n my-test`)}`,
      ),
    );
    process.exit(1);
  }

  // Step 2: Select scenario if not provided
  if (!scenario) {
    const scenarioAnswer = await inquirer.prompt([
      {
        type: "select",
        name: "selected",
        message: "Select a scenario to run:",
        choices: files,
      },
    ]);
    scenario = scenarioAnswer.selected;
  }

  const scenarioPath = path.join(scenariosDir, scenario);
  if (!fs.existsSync(scenarioPath)) {
    console.error(chalk.red(`\n✗ Scenario file does not exist: ${scenario}`));
    console.log(chalk.yellow(`Available scenarios: ${files.join(", ")}`));
    process.exit(1);
  }

  // Build docker-compose command
  const cmd = "docker-compose";
  const args = [
    "run",
    "--rm",
    engine,
    "run",
    `/${engine}/scenarios/${scenario}`,
  ];

  console.log(
    chalk.blue(`\n▶ Running ${engine} scenario: ${chalk.bold(scenario)}`),
  );
  console.log(chalk.dim(`  Command: ${cmd} ${args.join(" ")}\n`));

  const child = spawn(cmd, args, { stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    if (code === 0) {
      console.log(chalk.green(`\n✓ Test completed successfully!`));
      console.log(
        chalk.cyan(
          `  View results in Grafana: ${chalk.bold(`http://localhost:${process.env.GRAFANA_PORT || 3000}`)}`,
        ),
      );
    } else if (code !== 130) {
      // 130 es Ctrl+C
      console.log(chalk.red(`\n✗ Test failed with exit code ${code}`));
    }
    process.exit(code);
  });
}
