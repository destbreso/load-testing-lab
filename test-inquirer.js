import inquirer from "inquirer";

const answer = await inquirer.prompt([
  {
    type: "list",
    name: "engine",
    message: "Select the engine to use:",
    choices: [
      { name: "k6 (JavaScript-based load testing)", value: "k6" },
      { name: "Artillery (YAML-based load testing)", value: "artillery" },
    ],
  },
]);

console.log("You selected:", answer.engine);
