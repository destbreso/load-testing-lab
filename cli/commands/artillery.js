import runScenario from "../lib/run-scenario.js";

export default async function runArtillery(options) {
  await runScenario("artillery", options);
}
