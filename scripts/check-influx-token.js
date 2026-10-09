#!/usr/bin/env node

import dotenv from "dotenv";
import { fileURLToPath } from "url";

// The lab's own .env, wherever the script is run from
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
import axios from "axios";

const influxUrl =
  process.env.INFLUXDB_URL || `http://localhost:${process.env.INFLUXDB_PORT_EXPORT || 8086}`;
const org = process.env.INFLUXDB_ORG;
const token = process.env.INFLUXDB_TOKEN;

// check env
if (!org) {
  console.error("❌ INFLUXDB_ORG is not set in your environment.");
  process.exit(1);
}

if (!token) {
  console.error("❌ INFLUXDB_TOKEN is not set in your environment.");
  process.exit(1);
}

(async () => {
  try {
    const res = await axios.get(`${influxUrl}/api/v2/buckets?org=${org}`, {
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json",
      },
    });

    console.log("✅ Token works! Buckets in org:");
    res.data.buckets.forEach((b) => {
      console.log(`- ${b.name} (ID: ${b.id})`);
    });
  } catch (err) {
    if (err.response) {
      console.error(
        `❌ Failed to connect: ${err.response.status} ${err.response.statusText}`,
      );
      console.error(err.response.data);
    } else {
      console.error("❌ Error connecting to InfluxDB:", err.message);
    }
    process.exit(1);
  }
})();
