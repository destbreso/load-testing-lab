import fs from "fs";
import inquirer from "inquirer";
import chalk from "chalk";

export default async function configureEnv() {
  try {
    console.log(
      chalk.blue("Configure your Load Testing Lab environment (.env)"),
    );

    const answers = await inquirer.prompt([
      {
        name: "TARGET_API_URL",
        message: "API URL to test",
        default: "http://localhost:5000",
      },
      {
        name: "INFLUXDB_URL",
        message: "InfluxDB URL",
        default: "http://influxdb:8086",
      },
      {
        name: "INFLUXDB_TOKEN",
        message: "InfluxDB Token",
        default: "admin123",
      },
      { name: "INFLUXDB_ORG", message: "InfluxDB Org", default: "myorg" },
      {
        name: "INFLUXDB_BUCKET",
        message: "InfluxDB Bucket",
        default: "loadtests",
      },
      { name: "GRAFANA_USER", message: "Grafana User", default: "admin" },
      {
        name: "GRAFANA_PASSWORD",
        message: "Grafana Password",
        default: "admin123",
      },
      { name: "CONCURRENCY", message: "Default concurrency", default: "50" },
      { name: "DURATION", message: "Default duration", default: "60s" },
    ]);

    let content = "";
    for (const key in answers) content += `${key}=${answers[key]}\n`;

    fs.writeFileSync(".env", content);
    console.log(chalk.green(".env file created/updated successfully!"));
  } catch (err) {
    console.error(chalk.red("Failed to configure environment:"), err.message);
  }
}
