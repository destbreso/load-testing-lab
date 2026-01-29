/**
 * Spike Load Test Blueprint
 *
 * Purpose: Test system behavior under sudden, dramatic load increases
 *
 * Use cases:
 * - Testing auto-scaling responsiveness
 * - Validating circuit breakers and rate limiters
 * - Simulating traffic from viral content
 * - Testing elasticity and recovery
 * - Finding bottlenecks under sudden load
 *
 * Pattern:
 * 1. Start with low baseline load
 * 2. Sudden spike to 10x-20x baseline
 * 3. Hold spike briefly
 * 4. Drop back to baseline
 * 5. Observe recovery
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const responseTime = new Trend("response_time");
const requests = new Counter("requests");

export const options = {
  stages: [
    { duration: "2m", target: 10 }, // Baseline: normal load
    { duration: "30s", target: 200 }, // SPIKE: sudden 20x increase
    { duration: "3m", target: 200 }, // Hold spike
    { duration: "30s", target: 10 }, // Drop back to baseline
    { duration: "3m", target: 10 }, // Recovery period
    { duration: "1m", target: 0 }, // Cool down
  ],

  thresholds: {
    http_req_duration: [
      "p(50)<500", // Median should stay below 500ms
      "p(95)<2000", // 95th percentile can be higher during spike
    ],
    http_req_failed: ["rate<0.10"], // Allow up to 10% errors during spike
    errors: ["rate<0.10"],
  },
};

export default function () {
  const TARGET_URL = __ENV.TARGET_API_URL || "http://localhost:5000";

  // Simulate varied endpoints
  const endpoints = ["/api/health", "/api/status", "/api/info"];
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const response = http.get(`${TARGET_URL}${endpoint}`);
  requests.add(1);

  const result = check(response, {
    "status is 200 or 429": (r) => r.status === 200 || r.status === 429, // Accept rate limiting
    "has response body": (r) => r.body && r.body.length > 0,
  });

  errorRate.add(!result);
  responseTime.add(response.timings.duration);

  // Variable sleep to create more realistic traffic
  sleep(Math.random() * 2);
}
