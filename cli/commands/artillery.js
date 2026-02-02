import { execa } from "execa";
import chalk from "chalk";
import { existsSync, statSync } from "fs";
import { resolve, basename, dirname } from "path";
import { fileURLToPath } from "url";

// Get the lab's root directory (where docker-compose.yml is)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LAB_ROOT = resolve(__dirname, "../..");

export default async function runArtillery(options) {
  const scenarioFile = options.scenario;
  const projectDir = options.project; // Optional: mount entire project directory

  // Check if it's a local file (external to the project)
  const resolvedPath = resolve(process.cwd(), scenarioFile);
  const isLocalFile =
    existsSync(resolvedPath) && statSync(resolvedPath).isFile();

  let dockerArgs;
  let containerPath;

  if (projectDir) {
    // Mount entire project directory (for scenarios with helpers, data files, etc.)
    const resolvedProjectDir = resolve(process.cwd(), projectDir);
    
    if (!existsSync(resolvedProjectDir) || !statSync(resolvedProjectDir).isDirectory()) {
      console.error(chalk.red(`Project directory not found: ${projectDir}`));
      return;
    }

    // Scenario path relative to project dir
    containerPath = `/project/${scenarioFile}`;

    console.log(chalk.blue(`Running Artillery with project: ${projectDir}`));
    console.log(chalk.dim(`  Mounting: ${resolvedProjectDir} → /project`));
    console.log(chalk.dim(`  Scenario: ${scenarioFile}`));

    dockerArgs = [
      "run",
      "--rm",
      "-v",
      `${resolvedProjectDir}:/project:ro`,
      "artillery",
      "run",
      containerPath,
    ];
  } else if (isLocalFile) {
    // Mount the local file's directory and run from there
    const localDir = dirname(resolvedPath);
    const fileName = basename(resolvedPath);
    containerPath = `/external/${fileName}`;

    console.log(
      chalk.blue(`Running Artillery with external scenario: ${scenarioFile}`),
    );
    console.log(chalk.dim(`  Mounting: ${localDir} → /external`));

    dockerArgs = [
      "run",
      "--rm",
      "-v",
      `${localDir}:/external:ro`,
      "artillery",
      "run",
      containerPath,
    ];
  } else {
    // Use built-in scenario from the project
    containerPath = `/artillery/scenarios/${scenarioFile}`;
    console.log(
      chalk.blue(`Running Artillery with built-in scenario: ${scenarioFile}`),
    );

    dockerArgs = ["run", "--rm", "artillery", "run", containerPath];
  }

  try {
    // Run docker-compose from the lab's root directory
    await execa("docker-compose", dockerArgs, { 
      stdio: "inherit",
      cwd: LAB_ROOT 
    });
    console.log(chalk.green("Artillery test completed!"));
  } catch (err) {
    console.error(chalk.red("Artillery test failed:"), err.message);
  }
}
