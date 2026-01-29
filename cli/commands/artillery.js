import { execa } from "execa";
import chalk from "chalk";

export default async function runArtillery(options) {
  const scenarioFile = options.scenario;
  console.log(chalk.blue(`Running Artillery scenario: ${scenarioFile}`));
  try {
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
    console.log(chalk.green("Artillery test completed!"));
  } catch (err) {
    console.error(chalk.red("Artillery test failed:"), err.message);
  }
}
