#!/usr/bin/env node
import "dotenv/config";
import axios from "axios";
import chalk from "chalk";

async function resetMetrics() {
  const influxUrl = process.env.INFLUXDB_URL || "http://localhost:8086";
  const org = process.env.INFLUXDB_ORG || "ltl";
  const token = process.env.INFLUXDB_TOKEN || "admin123";

  console.log(chalk.blue("🗑️  Resetting InfluxDB metrics...\n"));

  try {
    // First, get all buckets
    console.log(chalk.dim("Fetching buckets..."));
    const bucketsResponse = await axios.get(`${influxUrl}/api/v2/buckets`, {
      headers: {
        Authorization: `Token ${token}`,
      },
    });

    const buckets = bucketsResponse.data.buckets.filter(
      (b) => !b.name.startsWith("_"), // Skip system buckets
    );

    if (buckets.length === 0) {
      console.log(chalk.yellow("No user buckets found to reset."));
      return;
    }

    console.log(chalk.white(`Found ${buckets.length} bucket(s) to reset:\n`));

    // Delete data from each bucket
    let successCount = 0;
    let errorCount = 0;

    for (const bucket of buckets) {
      try {
        console.log(chalk.dim(`  • Clearing ${bucket.name}...`));

        const deleteUrl = `${influxUrl}/api/v2/delete?org=${org}&bucket=${bucket.name}`;

        await axios.post(
          deleteUrl,
          {
            start: "1970-01-01T00:00:00Z",
            stop: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            predicate: "_measurement=~/.*/", // Match all measurements
          },
          {
            headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        console.log(chalk.green(`    ✓ ${bucket.name} cleared`));
        successCount++;
      } catch (err) {
        console.log(chalk.red(`    ✗ ${bucket.name} failed: ${err.message}`));
        errorCount++;
      }
    }

    console.log();

    if (successCount > 0) {
      console.log(
        chalk.green(`✅ Successfully reset ${successCount} bucket(s)`),
      );
    }

    if (errorCount > 0) {
      console.log(chalk.yellow(`⚠️  Failed to reset ${errorCount} bucket(s)`));
      process.exit(1);
    }
  } catch (err) {
    console.error(chalk.red("\n❌ Failed to reset metrics:"), err.message);

    if (err.code === "ECONNREFUSED") {
      console.log(
        chalk.yellow("\n💡 InfluxDB is not running. Start the lab first:"),
      );
      console.log(chalk.cyan("   ltlab start\n"));
    } else if (err.response?.status === 401) {
      console.log(
        chalk.yellow("\n💡 Authentication failed. Check your token in .env"),
      );
    } else if (err.response?.status === 404) {
      console.log(
        chalk.yellow(
          "\n💡 Bucket not found. The lab may need to be restarted.",
        ),
      );
    }

    process.exit(1);
  }
}

resetMetrics();
