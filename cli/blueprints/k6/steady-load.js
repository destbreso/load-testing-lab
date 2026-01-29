/**
 * Steady Load Test Blueprint
 *
 * Purpose: Maintain constant load over time to establish baseline performance
 *
 * Use cases:
 * - Baseline performance testing
 * - Finding average response times
 * - Establishing normal behavior patterns
 * - Smoke testing before heavier load
 *
 * Customize:
 * - Adjust VUs (virtual users) for your target concurrency
 * - Change duration based on your test requirements
 * - Replace /api/health with your actual endpoints
 * - Add checks to validate responses
 * - Configure thresholds for pass/fail criteria
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");

// Test configuration
export const options = {
  vus: 50, // Number of virtual users
  duration: "10m", // Test duration

  // Thresholds define pass/fail criteria
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests should be below 500ms
    http_req_failed: ["rate<0.01"], // Error rate should be less than 1%
    errors: ["rate<0.01"],
  },
};

// Main test function - executed by each VU repeatedly
export default function () {
  const TARGET_URL = __ENV.TARGET_API_URL || "http://localhost:5000";

  // Make HTTP request
  const response = http.get(`${TARGET_URL}/api/health`);

  // Validate response
  const result = check(response, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  // Track errors
  errorRate.add(!result);

  // Simulate user think time (1 second)
  sleep(1);
}
