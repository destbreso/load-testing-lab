import { execa } from "execa";
import chalk from "chalk";

export default async function runK6(options) {
  const scenarioFile = options.scenario;
  console.log(chalk.blue(`Running k6 scenario: ${scenarioFile}`));
  try {
    await execa(
      "docker-compose",
      ["run", "--rm", "k6", "run", `/k6/scenarios/${scenarioFile}`],
      { stdio: "inherit" },
    );
    console.log(chalk.green("k6 test completed!"));
  } catch (err) {
    console.error(chalk.red("k6 test failed:"), err.message);
  }
}
