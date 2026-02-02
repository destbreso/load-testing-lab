import chalk from "chalk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LAB_ROOT = path.resolve(__dirname, "../..");

export default async function dashboardCmd(action, source, options) {
  const grafanaDashboardsDir = path.join(LAB_ROOT, "grafana", "dashboards");

  switch (action) {
    case "link":
    case "copy":
      await linkDashboards(source, grafanaDashboardsDir);
      break;
    case "list":
      await listDashboards(grafanaDashboardsDir, source);
      break;
    case "unlink":
      await unlinkDashboards(grafanaDashboardsDir);
      break;
    default:
      console.log(chalk.yellow("Usage:"));
      console.log(
        "  ltlab dashboard link <dir>   - Copy dashboards to lab (from your project)",
      );
      console.log("  ltlab dashboard list         - List current dashboards");
      console.log("  ltlab dashboard unlink       - Remove custom dashboards");
      console.log("");
      console.log(chalk.dim("Your project folder is the source of truth."));
      console.log(
        chalk.dim("Run 'link' again to sync changes from your project."),
      );
  }
}

async function linkDashboards(sourceDir, targetDir) {
  if (!sourceDir) {
    console.error(chalk.red("Please specify source directory"));
    return;
  }

  const resolvedSource = path.resolve(process.cwd(), sourceDir);

  if (!fs.existsSync(resolvedSource)) {
    console.error(chalk.red(`Directory not found: ${sourceDir}`));
    return;
  }

  // Find all JSON files
  const files = fs
    .readdirSync(resolvedSource)
    .filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.log(chalk.yellow("No JSON dashboard files found in directory"));
    return;
  }

  // Create custom subdirectory for external dashboards
  const customDir = path.join(targetDir, "custom");

  // Remove existing custom dir if exists
  if (fs.existsSync(customDir)) {
    fs.rmSync(customDir, { recursive: true, force: true });
  }
  fs.mkdirSync(customDir, { recursive: true });

  // Copy files (Docker can't follow symlinks outside mounted directories)
  for (const file of files) {
    const src = path.join(resolvedSource, file);
    const dest = path.join(customDir, file);
    fs.copyFileSync(src, dest);
    console.log(chalk.dim(`   Copied: ${file}`));
  }

  // Store source path for sync command
  const metaFile = path.join(customDir, ".source");
  fs.writeFileSync(metaFile, resolvedSource);

  console.log(
    chalk.green(`\n✅ ${files.length} dashboard(s) linked successfully!`),
  );
  console.log(chalk.dim(`   Source: ${resolvedSource}`));
  console.log(chalk.dim(`   Target: ${customDir}`));
  console.log("");
  console.log(chalk.yellow("Note: Restart Grafana to load new dashboards:"));
  console.log(chalk.white("   ltlab restart -s grafana"));
  console.log("");
  console.log(
    chalk.dim(
      "To sync changes from source, run: ltlab dashboard link <dir> again",
    ),
  );
  console.log(
    chalk.dim("Dashboards will appear in Grafana under 'custom' folder"),
  );
}

async function listDashboards(dashboardsDir, subdir) {
  const targetDir = subdir ? path.join(dashboardsDir, subdir) : dashboardsDir;

  if (!fs.existsSync(targetDir)) {
    console.log(chalk.yellow(`Directory not found: ${targetDir}`));
    return;
  }

  console.log(chalk.blue("📊 Grafana Dashboards:"));
  console.log(chalk.dim(`   Location: ${dashboardsDir}\n`));

  const items = fs.readdirSync(dashboardsDir, { withFileTypes: true });

  for (const item of items) {
    if (item.isDirectory()) {
      const subPath = path.join(dashboardsDir, item.name);
      const isSymlink = fs.lstatSync(subPath).isSymbolicLink();
      const prefix = isSymlink ? "🔗" : "📁";
      console.log(chalk.cyan(`${prefix} ${item.name}/`));

      const subFiles = fs
        .readdirSync(subPath)
        .filter((f) => f.endsWith(".json"));
      subFiles.forEach((f) => console.log(chalk.dim(`      ${f}`)));
    } else if (item.name.endsWith(".json")) {
      console.log(chalk.white(`   ${item.name}`));
    }
  }
}

async function unlinkDashboards(dashboardsDir) {
  const customDir = path.join(dashboardsDir, "custom");

  if (!fs.existsSync(customDir)) {
    console.log(chalk.yellow("No custom dashboards linked"));
    return;
  }

  // Count dashboards being removed
  const files = fs.readdirSync(customDir).filter((f) => f.endsWith(".json"));

  // Remove entire custom directory (works for both symlink and copied files)
  fs.rmSync(customDir, { recursive: true, force: true });

  console.log(
    chalk.green(`✅ Custom dashboards removed (${files.length} dashboard(s))`),
  );
  console.log("");
  console.log(chalk.yellow("Note: Restart Grafana to apply changes:"));
  console.log(chalk.white("   ltlab restart -s grafana"));
}
