import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get project directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

export default async function generateCmd(options) {
  let { engine, name } = options;

  // Step 1: Select engine if not provided
  if (!engine) {
    const engineAnswer = await inquirer.prompt([
      {
        type: "select",
        name: "engine",
        message: "Select the engine for your scenario:",
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

  // Blueprints folder (use absolute path to project)
  const blueprintsDir = path.join(projectRoot, "cli", "blueprints", engine);

  if (!fs.existsSync(blueprintsDir)) {
    console.error(
      chalk.red(`No blueprints folder found for ${engine} at ${blueprintsDir}`),
    );
    process.exit(1);
  }

  // List templates
  const templates = fs
    .readdirSync(blueprintsDir)
    .filter((f) => f.endsWith(engine === "k6" ? ".js" : ".yml"));

  if (templates.length === 0) {
    console.error(chalk.red(`No blueprints available for ${engine}`));
    process.exit(1);
  }

  // Step 2: Select blueprint interactively
  const blueprintAnswer = await inquirer.prompt([
    {
      type: "select",
      name: "selected",
      message: "Select a blueprint to generate scenario from:",
      choices: templates.map((t) => ({
        name: `${t.replace(/\.(js|yml)$/, "")} - ${getBlueprintDescription(t)}`,
        value: t,
      })),
    },
  ]);

  const { selected } = blueprintAnswer;
  const templatePath = path.join(blueprintsDir, selected);

  // Step 3: Request name if not provided
  if (!name) {
    const nameAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Enter the name for the new scenario file:",
        validate: (input) => {
          if (!input || input.trim() === "") {
            return "Scenario name cannot be empty";
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
            return "Scenario name can only contain letters, numbers, hyphens, and underscores";
          }
          return true;
        },
      },
    ]);
    name = nameAnswer.name;
  }

  // Output folder (use absolute path to project)
  const targetDir =
    engine === "k6"
      ? path.join(projectRoot, "k6", "scenarios")
      : path.join(projectRoot, "artillery", "scenarios");

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const ext = engine === "k6" ? ".js" : ".yml";
  const targetPath = path.join(targetDir, `${name}${ext}`);

  if (fs.existsSync(targetPath)) {
    console.error(chalk.red(`\n✗ Scenario file already exists: ${targetPath}`));
    console.log(
      chalk.yellow("Choose a different name or delete the existing file."),
    );
    process.exit(1);
  }

  // Copiar blueprint al escenario
  fs.copyFileSync(templatePath, targetPath);
  console.log(chalk.green(`\n✓ Scenario generated successfully!`));
  console.log(chalk.cyan(`  File: ${targetPath}`));
  console.log(chalk.dim(`  Template: ${selected}`));
  console.log(
    chalk.yellow(
      `\nNext: Edit ${targetPath} to customize your load test scenario`,
    ),
  );
}

// Helper function to get blueprint descriptions
function getBlueprintDescription(filename) {
  const descriptions = {
    "steady-load": "Constant load over time",
    "ramp-up-down": "Gradual increase and decrease",
    "spike-load": "Sudden traffic spikes",
    "endpoint-thinktime": "Realistic user behavior with delays",
    "variable-traffic": "Fluctuating load patterns",
  };

  const key = filename.replace(/\.(js|yml)$/, "");
  return descriptions[key] || "";
}
