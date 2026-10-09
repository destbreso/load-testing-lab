import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const retryCounter = new Counter('retries');
// Attempts each call to /error needed (1 to 3)
const attempts = new Trend('attempts');

export const options = {
  stages: [
    { duration: '1m', target: 30 },   // Gradual ramp up
    { duration: '3m', target: 30 },   // Sustained load with errors
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(90)<4000'],
    'errors': ['rate<0.4'],
    // /error fails 30% of the time, so a call needs 1.39 attempts on average
    'attempts': ['avg<1.5'],
  },
};

export default function () {
  const baseUrl = __ENV.TARGET_API_URL || 'http://toy-api:5000';
  
  // Resilience testing: Handle errors gracefully with retries
  const endpoint = `${baseUrl}/error`; // Endpoint with 30% error rate
  const maxRetries = 3;
  let attempt = 0;
  let success = false;
  
  while (attempt < maxRetries && !success) {
    attempt++;
    
    const res = http.get(endpoint, {
      timeout: '5s',
      tags: { 
        attempt: attempt.toString(),
      },
    });
    
    success = check(res, {
      'status is 200': (r) => r.status === 200,
    });
    
    if (!success && attempt < maxRetries) {
      retryCounter.add(1);
      // Exponential backoff: 0.5s, 1s, 2s
      sleep(0.5 * Math.pow(2, attempt - 1));
    }
  }
  
  // Track final result
  errorRate.add(!success);
  attempts.add(attempt);
  
  // Also test other endpoints occasionally
  if (Math.random() < 0.3) {
    const mixEndpoints = [
      `${baseUrl}/fast`,
      `${baseUrl}/slow`,
      `${baseUrl}/cpu`,
    ];
    
    const randomEndpoint = mixEndpoints[Math.floor(Math.random() * mixEndpoints.length)];
    const res = http.get(randomEndpoint, { timeout: '5s' });
    
    check(res, {
      'status is 200': (r) => r.status === 200,
    });
  }
  
  // Normal think time
  sleep(1 + Math.random() * 2);
}
