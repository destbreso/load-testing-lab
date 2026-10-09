import chalk from "chalk";
import { existsSync, statSync } from "fs";
import { resolve, basename, dirname } from "path";
import { compose, exitCodeOf } from "./lab.js";

const LABEL = { k6: "k6", artillery: "Artillery" };

// Runs a scenario with k6 or Artillery in a one-off container.
// -s names a built-in scenario, or a local file whose folder is mounted
// at /external; with -p, a whole project folder is mounted at /project
// and -s is relative to it. Each -e adds an environment variable to the
// container: -e KEY=value as given, -e KEY with the value from your shell
// (so a secret stays off the command line). The run's exit code becomes
// the CLI's.
export default async function runScenario(engine, options) {
  const scenarioFile = options.scenario;
  const projectDir = options.project;
  const label = LABEL[engine];
  const envArgs = (options.env || []).flatMap((pair) => ["-e", pair]);

  const resolvedPath = resolve(process.cwd(), scenarioFile);
  const isLocalFile = existsSync(resolvedPath) && statSync(resolvedPath).isFile();

  let args;

  if (projectDir) {
    const resolvedProjectDir = resolve(process.cwd(), projectDir);
    if (!existsSync(resolvedProjectDir) || !statSync(resolvedProjectDir).isDirectory()) {
      console.error(chalk.red(`Project directory not found: ${projectDir}`));
      process.exitCode = 1;
      return;
    }
    console.log(chalk.blue(`Running ${label} with project: ${projectDir}`));
    console.log(chalk.dim(`  Mounting: ${resolvedProjectDir} → /project`));
    console.log(chalk.dim(`  Scenario: ${scenarioFile}`));
    args = ["run", "--rm", ...envArgs, "-v", `${resolvedProjectDir}:/project:ro`, engine, "run", `/project/${scenarioFile}`];
  } else if (isLocalFile) {
    const localDir = dirname(resolvedPath);
    console.log(chalk.blue(`Running ${label} with external scenario: ${scenarioFile}`));
    console.log(chalk.dim(`  Mounting: ${localDir} → /external`));
    args = ["run", "--rm", ...envArgs, "-v", `${localDir}:/external:ro`, engine, "run", `/external/${basename(resolvedPath)}`];
  } else {
    console.log(chalk.blue(`Running ${label} with built-in scenario: ${scenarioFile}`));
    args = ["run", "--rm", ...envArgs, engine, "run", `/${engine}/scenarios/${scenarioFile}`];
  }

  try {
    await compose(args);
    console.log(chalk.green(`${label} test completed!`));
  } catch (err) {
    const code = exitCodeOf(err);
    if (engine === "k6" && code === 99) {
      console.error(chalk.red("k6 test failed: at least one threshold was crossed (exit code 99)"));
    } else {
      console.error(chalk.red(`${label} test failed with exit code ${code}`));
    }
    process.exitCode = code;
  }
}
