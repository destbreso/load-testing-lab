export default {
  vus: Number(__ENV.CONCURRENCY) || 50,
  duration: __ENV.DURATION || "60s",
  thresholds: {
    http_req_duration: ["p95<500", "p99<1000"], // latency thresholds in ms
    http_req_failed: ["rate<0.01"], // fail rate < 1%
  },
  ext: {
    influxdb: {
      address: __ENV.INFLUXDB_URL || "http://localhost:8086",
      token: __ENV.INFLUXDB_TOKEN,
      org: __ENV.INFLUXDB_ORG,
      bucket: __ENV.INFLUXDB_BUCKET,
      tags: { project: "load-testing-lab" },
    },
  },
};
