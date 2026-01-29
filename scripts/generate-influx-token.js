#!/usr/bin/env node
import "dotenv/config";
import { execSync } from "child_process";

const INFLUX_CONTAINER = "influxdb";
const INFLUX_USER = process.env.INFLUXDB_USER;
const INFLUX_ORG = process.env.INFLUXDB_ORG;
const INFLUX_BUCKET = process.env.INFLUXDB_BUCKET;

// check env
if (!INFLUX_USER) {
  console.error("❌ INFLUXDB_USER is not set in your environment.");
  process.exit(1);
}

if (!INFLUX_ORG) {
  console.error("❌ INFLUXDB_ORG is not set in your environment.");
  process.exit(1);
}

if (!INFLUX_BUCKET) {
  console.error("❌ INFLUXDB_BUCKET is not set in your environment.");
  process.exit(1);
}

try {
  console.log(
    `🔹 Generating token for user '${INFLUX_USER}' in container '${INFLUX_CONTAINER}'...`,
  );

  // docker exec -it influxdb influx auth create \
  // --read-buckets \
  // --write-buckets \
  // --org myorg \
  // --description "Token k6/artillery"

  // const command = `docker exec ${INFLUX_CONTAINER} influx auth create \
  //   --read-buckets \
  //   --write-buckets \
  //   --bucket ${INFLUX_BUCKET} \
  //   --org ${INFLUX_ORG} \
  //   --description "Token k6/artillery" \
  //   --json`;

  const command = `
    docker exec -i ${INFLUX_CONTAINER} influx auth create \
      --user ${INFLUX_USER} \
      --read-buckets \
      --write-buckets \
      --org ${INFLUX_ORG} \
      --description "Token k6/artillery" \
      --json
  `;

  const output = execSync(command, { encoding: "utf8" });
  const result = JSON.parse(output);
  console.log("✅ Token generated successfully:");
  console.log(result.token);
} catch (err) {
  console.error("❌ Error generating token:", err.message);
  process.exit(1);
}
