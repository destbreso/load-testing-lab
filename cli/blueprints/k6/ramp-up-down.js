/**
 * Ramp-Up/Ramp-Down Load Test Blueprint
 *
 * Purpose: Gradually increase load to find capacity limits and observe behavior under varying load
 *
 * Use cases:
 * - Capacity planning
 * - Finding breaking points
 * - Testing auto-scaling behavior
 * - Observing performance degradation patterns
 * - Warm-up before peak load
 *
 * Pattern:
 * 1. Ramp up from 0 to 50 VUs (warm-up)
 * 2. Ramp up to 100 VUs (increasing load)
 * 3. Hold at 100 VUs (sustained load)
 * 4. Ramp up to peak (stress)
 * 5. Ramp down to baseline
 * 6. Cool down to 0
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const responseTime = new Trend("response_time");

export const options = {
  stages: [
    { duration: "2m", target: 50 }, // Ramp-up to baseline
    { duration: "5m", target: 100 }, // Ramp-up to moderate load
    { duration: "10m", target: 100 }, // Hold at moderate load
    { duration: "3m", target: 200 }, // Spike to peak
    { duration: "5m", target: 100 }, // Ramp-down to moderate
    { duration: "5m", target: 0 }, // Cool down
  ],

  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.05"], // Allow 5% error rate under high load
    errors: ["rate<0.05"],
  },
};

export default function () {
  const TARGET_URL = __ENV.TARGET_API_URL || "http://localhost:5000";

  // Test multiple endpoints
  const response = http.get(`${TARGET_URL}/api/health`);

  const result = check(response, {
    "status is 200": (r) => r.status === 200,
    "response time acceptable": (r) => r.timings.duration < 1000,
  });

  errorRate.add(!result);
  responseTime.add(response.timings.duration);

  sleep(1);
}
