import chalk from "chalk";
import axios from "axios";

export default async function showMetrics() {
  try {
    console.log(chalk.cyan.bold("\n📊 InfluxDB Metrics Overview\n"));

    const influxUrl = process.env.INFLUXDB_URL || "http://localhost:8086";
    const token = process.env.INFLUXDB_TOKEN || "admin123";
    const org = process.env.INFLUXDB_ORG || "ltl";

    // Check if InfluxDB is running
    try {
      await axios.get(`${influxUrl}/health`, {
        timeout: 5000,
      });
    } catch (err) {
      console.log(chalk.red("❌ Cannot connect to InfluxDB"));
      console.log(chalk.yellow("\nMake sure the lab is running:"));
      console.log(chalk.cyan("  ltlab start"));
      console.log(chalk.dim(`\n  Expected URL: ${influxUrl}\n`));
      return;
    }

    console.log(chalk.green("✓ InfluxDB is running\n"));

    // Fetch buckets
    console.log(chalk.white("📦 Available Buckets:\n"));
    
    try {
      const bucketsResponse = await axios.get(`${influxUrl}/api/v2/buckets`, {
        headers: {
          Authorization: `Token ${token}`,
        },
      });

      const bucketsData = bucketsResponse.data;
      
      if (bucketsData.buckets && bucketsData.buckets.length > 0) {
        for (const bucket of bucketsData.buckets) {
          // Skip system buckets
          if (bucket.name.startsWith("_")) continue;
          
          console.log(chalk.cyan(`  • ${bucket.name}`));
          console.log(chalk.dim(`    ID: ${bucket.id}`));
          console.log(chalk.dim(`    Retention: ${bucket.retentionRules?.[0]?.everySeconds ? bucket.retentionRules[0].everySeconds / 86400 + " days" : "infinite"}`));
          console.log();
        }
      } else {
        console.log(chalk.yellow("  No user buckets found\n"));
      }
    } catch (err) {
      console.log(chalk.red(`  ❌ Failed to fetch buckets: ${err.message}\n`));
    }

    // Show connection info
    console.log(chalk.white("🔗 Connection Info:\n"));
    console.log(chalk.dim(`  URL:      ${influxUrl}`));
    console.log(chalk.dim(`  Org:      ${org}`));
    console.log(chalk.dim(`  Token:    ${token.substring(0, 10)}...`));
    console.log();

    // Show Grafana link
    const grafanaPort = process.env.GRAFANA_PORT || 3000;
    console.log(chalk.white("📈 View Metrics:\n"));
    console.log(chalk.cyan(`  Grafana:  http://localhost:${grafanaPort}`));
    console.log(chalk.cyan(`  InfluxDB: ${influxUrl}`));
    console.log();

    // Tips
    console.log(chalk.yellow("💡 Tips:\n"));
    console.log(chalk.white("  • View detailed metrics in Grafana dashboards"));
    console.log(chalk.white("  • Access InfluxDB UI for raw data exploration"));
    console.log(chalk.white("  • Use 'ltlab reset' to clear all metrics"));
    console.log();

  } catch (err) {
    console.error(chalk.red("\n❌ Error fetching metrics:"), err.message);
    console.log(chalk.yellow("\nTroubleshooting:"));
    console.log(chalk.white("  1. Ensure the lab is running: ltlab start"));
    console.log(chalk.white("  2. Check .env configuration: ltlab info"));
    console.log(chalk.white("  3. Verify InfluxDB is healthy: docker-compose ps\n"));
  }
}
