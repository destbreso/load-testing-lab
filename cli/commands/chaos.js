import { execa } from "execa";
import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

export default async function chaosTest(options = {}) {
  try {
    console.log(chalk.cyan.bold("\n🌪️  Chaos Engineering Mode\n"));
    console.log(
      chalk.yellow(
        "Test your dashboards and learn load testing patterns without external APIs!",
      ),
    );
    console.log(
      chalk.dim("Perfect for tutorials, demos, and understanding metrics.\n"),
    );

    // Step 1: Select engine
    let engine = options.engine;
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

    // Validar engine
    if (!["k6", "artillery"].includes(engine)) {
      console.error(chalk.red('Engine must be "k6" or "artillery"'));
      process.exit(1);
    }

    // Step 2: Select chaos scenario type
    const { chaosType } = await inquirer.prompt([
      {
        type: "select",
        name: "chaosType",
        message: "Select chaos scenario:",
        choices: [
          {
            name: `${chalk.yellow("Basic")} - Mixed chaos with random errors, latency, and resource issues`,
            value: "basic",
          },
          {
            name: `${chalk.red("Spike")} - Traffic spike with everything going wrong simultaneously`,
            value: "spike",
          },
          {
            name: `${chalk.green("Resilience")} - Test retry logic and error recovery patterns`,
            value: "resilience",
          },
        ],
      },
    ]);

    // Map to scenario files
    const scenarioMap = {
      k6: {
        basic: "chaos-basic.js",
        spike: "chaos-spike.js",
        resilience: "chaos-resilience.js",
      },
      artillery: {
        basic: "chaos-basic.yml",
        spike: "chaos-spike.yml",
        resilience: "chaos-resilience.yml",
      },
    };

    const scenarioFile = scenarioMap[engine][chaosType];

    // Carpeta de escenarios (usar ruta absoluta al proyecto)
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

    const scenarioPath = path.join(scenariosDir, scenarioFile);
    if (!fs.existsSync(scenarioPath)) {
      console.error(chalk.red(`\n❌ Scenario file not found: ${scenarioPath}`));
      console.log(chalk.yellow("\nAvailable chaos scenarios should be in:"));
      console.log(chalk.cyan(`  ${engine}/scenarios/chaos-*.{js,yml}`));
      process.exit(1);
    }

    // Show what will happen
    console.log(chalk.cyan("\n📋 Chaos Test Configuration:"));
    console.log(chalk.white(`  Engine:   ${engine}`));
    console.log(chalk.white(`  Scenario: ${chaosType}`));
    console.log(chalk.white(`  File:     ${scenarioFile}`));
    console.log(
      chalk.white(
        `  Target:   ${process.env.TARGET_API_URL || "http://toy-api:5000"}`,
      ),
    );

    // Describe what each scenario does
    const descriptions = {
      basic:
        "Tests mixed chaos with random errors (30% failure rate), slow responses (500-2500ms), and CPU-intensive operations. Good for learning to interpret metrics under unstable conditions.",
      spike:
        "Simulates sudden traffic spike (10 → 50 VUs) while hitting all problematic endpoints. Shows how your system behaves when everything goes wrong at once.",
      resilience:
        "Tests error recovery with retry logic and exponential backoff. Demonstrates how to handle errors gracefully and measure recovery time.",
    };

    console.log(chalk.dim(`\n  ${descriptions[chaosType]}\n`));

    // Confirm
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "Start chaos test?",
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow("\n⚠️  Chaos test cancelled."));
      return;
    }

    console.log(chalk.cyan(`\n🚀 Starting chaos test with ${engine}...\n`));

    // Execute test
    if (engine === "k6") {
      await execa(
        "docker-compose",
        ["run", "--rm", "k6", "run", `/k6/scenarios/${scenarioFile}`],
        { stdio: "inherit" },
      );
    } else {
      await execa(
        "docker-compose",
        [
          "run",
          "--rm",
          "artillery",
          "run",
          `/artillery/scenarios/${scenarioFile}`,
        ],
        { stdio: "inherit" },
      );
    }

    console.log(chalk.green("\n✅ Chaos test completed!\n"));
    console.log(chalk.cyan("📊 View results in Grafana:"));
    console.log(
      chalk.white(`   http://localhost:${process.env.GRAFANA_PORT || 3000}\n`),
    );
    console.log(chalk.yellow("💡 What to look for in dashboards:"));
    console.log(chalk.white("   • Error rate spikes during chaos"));
    console.log(chalk.white("   • Response time increases (p95, p99)"));
    console.log(chalk.white("   • Request throughput patterns"));
    console.log(chalk.white("   • Recovery time after errors"));
    console.log(
      chalk.white("   • Difference between success vs failed requests\n"),
    );
  } catch (err) {
    console.error(chalk.red("\n❌ Chaos test failed:"), err.message);
    process.exit(1);
  }
}
