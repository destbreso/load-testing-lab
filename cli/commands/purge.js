import { spawn } from "child_process";
import inquirer from "inquirer";
import chalk from "chalk";

// Generate random confirmation code
function generateConfirmationCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default async function purgeCmd() {
  console.log(chalk.red.bold("\n⚠️  DANGER ZONE - PURGE ALL DATA ⚠️\n"));
  console.log(chalk.yellow("This command will:"));
  console.log(chalk.dim("  • Stop all running containers"));
  console.log(chalk.dim("  • Remove all containers"));
  console.log(chalk.red.bold("  • DELETE ALL VOLUMES (metrics data, dashboards, etc.)"));
  console.log(chalk.dim("  • Remove networks"));
  console.log(chalk.red("\n❌ ALL TEST DATA WILL BE PERMANENTLY LOST!\n"));

  // First confirmation
  const firstConfirm = await inquirer.prompt([
    {
      type: "confirm",
      name: "proceed",
      message: "Are you absolutely sure you want to continue?",
      default: false,
    },
  ]);

  if (!firstConfirm.proceed) {
    console.log(chalk.green("\n✓ Purge cancelled - no changes made"));
    process.exit(0);
  }

  // Second confirmation with code
  const confirmationCode = generateConfirmationCode();
  console.log(chalk.yellow(`\nTo confirm, type the code: ${chalk.bold.red(confirmationCode)}`));

  const codeConfirm = await inquirer.prompt([
    {
      type: "input",
      name: "code",
      message: "Enter confirmation code:",
      validate: (input) => {
        if (input === confirmationCode) {
          return true;
        }
        return `Incorrect code. Type ${confirmationCode} to confirm.`;
      },
    },
  ]);

  if (codeConfirm.code !== confirmationCode) {
    console.log(chalk.green("\n✓ Purge cancelled - no changes made"));
    process.exit(0);
  }

  // Execute purge
  console.log(chalk.red(`\n▶ Purging all lab data...`));
  
  const cmd = "docker-compose";
  const args = ["down", "-v", "--remove-orphans"];
  
  console.log(chalk.dim(`  Command: ${cmd} ${args.join(" ")}\n`));

  const child = spawn(cmd, args, { stdio: "inherit", shell: true });

  child.on("exit", (code) => {
    if (code === 0) {
      console.log(chalk.green(`\n✓ Lab purged successfully!`));
      console.log(chalk.cyan(`\nAll containers, volumes, and data have been removed.`));
      console.log(chalk.dim(`\nTo start fresh:`));
      console.log(chalk.green(`  ltlab start`));
    } else {
      console.log(chalk.red(`\n✗ Purge failed with exit code ${code}`));
    }
    process.exit(code);
  });
}
