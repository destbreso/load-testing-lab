import runScenario from "../lib/run-scenario.js";

export default async function runK6(options) {
  await runScenario("k6", options);
}
