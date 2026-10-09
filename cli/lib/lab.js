import { execa } from "execa";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// The lab's root directory (where docker-compose.yml and .env live),
// whatever directory the CLI is run from
export const LAB_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const ENV_PATH = path.join(LAB_ROOT, ".env");

// Parsed .env of the lab, or null when there is none yet
export function readLabEnv() {
  if (!fs.existsSync(ENV_PATH)) return null;
  return dotenv.parse(fs.readFileSync(ENV_PATH, "utf8"));
}

let composeBin;

// Docker Compose v2 or later, as the plugin (`docker compose`) or as the
// standalone binary (`docker-compose`), whichever this machine has
export async function composeCommand() {
  if (composeBin) return composeBin;
  for (const candidate of [["docker", "compose"], ["docker-compose"]]) {
    try {
      const { stdout } = await execa(candidate[0], [
        ...candidate.slice(1),
        "version",
        "--short",
      ]);
      const major = parseInt(stdout.trim().replace(/^v/, ""), 10);
      if (major >= 2) {
        composeBin = candidate;
        return composeBin;
      }
    } catch {
      // not installed, try the next one
    }
  }
  throw new Error(
    "Docker Compose v2 was not found. Install Docker Desktop, or Docker Engine with the Compose plugin.",
  );
}

// Runs a Compose command from the lab's root directory
export async function compose(args, options = {}) {
  const [bin, ...pre] = await composeCommand();
  return execa(bin, [...pre, ...args], {
    cwd: LAB_ROOT,
    stdio: "inherit",
    ...options,
  });
}

// How a Compose command reads on screen, for logs and hints
export async function composeDisplay(args) {
  const cmd = await composeCommand();
  return [...cmd, ...args].join(" ");
}

// Exit code of a failed command (execa error), for process.exitCode
export function exitCodeOf(err) {
  return typeof err?.exitCode === "number" && err.exitCode !== 0
    ? err.exitCode
    : 1;
}
