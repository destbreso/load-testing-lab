import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const timeoutRate = new Rate("timeouts");
const recoveryTime = new Trend("recovery_time");

export const options = {
  stages: [
    { duration: "20s", target: 10 }, // Normal load
    { duration: "30s", target: 50 }, // Spike - chaos begins!
    { duration: "40s", target: 50 }, // Sustained chaos
    { duration: "30s", target: 10 }, // Recovery
    { duration: "20s", target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_duration: ["p(99)<5000"], // Allow higher response times during chaos
    errors: ["rate<0.6"], // Accept higher error rate during chaos
    timeouts: ["rate<0.2"], // Keep timeouts under 20%
  },
};

export default function () {
  const baseUrl = __ENV.TARGET_API_URL || "http://toy-api:5000";

  // Chaos scenario: Everything that can go wrong
  const chaosEndpoints = [
    { url: `${baseUrl}/slow`, name: "Slow response", chaos: "latency" },
    { url: `${baseUrl}/error`, name: "Random errors", chaos: "errors" },
    { url: `${baseUrl}/cpu`, name: "CPU overload", chaos: "resource" },
    { url: `${baseUrl}/io`, name: "I/O bottleneck", chaos: "resource" },
  ];

  // Execute multiple requests in sequence to create realistic chaos
  const startTime = Date.now();
  let errorCount = 0;

  for (const endpoint of chaosEndpoints) {
    const res = http.get(endpoint.url, {
      timeout: "10s",
      tags: {
        endpoint: endpoint.name,
        chaos_type: endpoint.chaos,
      },
    });

    const success = check(res, {
      "status is 200": (r) => r.status === 200,
      "response time < 10s": (r) => r.timings.duration < 10000,
    });

    if (!success) errorCount++;

    errorRate.add(!success);
    if (res.status === 0 || res.timings.duration >= 10000) {
      timeoutRate.add(1);
    } else {
      timeoutRate.add(0);
    }

    // Small delay between requests
    sleep(0.2);
  }

  // Track total recovery time for this iteration
  recoveryTime.add(Date.now() - startTime);

  // Variable think time based on chaos
  if (errorCount > 2) {
    sleep(2 + Math.random() * 3); // Longer wait after many errors (user retry behavior)
  } else {
    sleep(0.5 + Math.random() * 1.5); // Normal think time
  }
}
