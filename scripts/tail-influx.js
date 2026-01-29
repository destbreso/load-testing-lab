#!/usr/bin/env node
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;
const BUCKET = process.env.INFLUXDB_BUCKET || "loadtests";

// check env
if (!INFLUX_URL) {
  console.error("❌ INFLUXDB_URL is not set in your environment.");
  process.exit(1);
}

if (!INFLUX_TOKEN) {
  console.error("❌ INFLUXDB_TOKEN is not set in your environment.");
  process.exit(1);
}

if (!INFLUX_ORG) {
  console.error("❌ INFLUXDB_ORG is not set in your environment.");
  process.exit(1);
}

// Number of rows to display
const LIMIT = 20;

// Flux query
const fluxQuery = `
from(bucket: "${BUCKET}")
  |> range(start: -1h)
  |> limit(n:${LIMIT})
`;

async function tailInflux() {
  try {
    const res = await axios.post(
      `${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`,
      fluxQuery,
      {
        headers: {
          Authorization: `Token ${INFLUX_TOKEN}`,
          Accept: "application/csv",
          "Content-Type": "application/vnd.flux",
        },
      },
    );
    console.log("=== Last Metrics ===\n");
    console.log(res.data);
  } catch (err) {
    console.error(
      "Error fetching data from InfluxDB:",
      err.response?.data || err.message,
    );
  }
}

tailInflux();
