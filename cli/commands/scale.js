import { execa } from "execa";
import chalk from "chalk";

export default async function scaleWorkers(options) {
  const tool = options.tool;
  const number = options.number;

  console.log(chalk.blue(`Scaling ${tool} workers to ${number}...`));
  try {
    await execa(
      "docker-compose",
      ["up", "--scale", `${tool}=${number}`, "-d"],
      { stdio: "inherit" },
    );
    console.log(chalk.green(`${tool} scaled successfully!`));
  } catch (err) {
    console.error(chalk.red("Failed to scale workers:"), err.message);
  }
}
