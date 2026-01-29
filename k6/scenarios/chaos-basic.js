import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const timeoutRate = new Rate('timeouts');

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 VUs
    { duration: '1m', target: 20 },  // Stay at 20 VUs
    { duration: '20s', target: 0 },  // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<3000'], // 95% of requests under 3s
    'errors': ['rate<0.5'],              // Error rate below 50%
  },
};

export default function () {
  const baseUrl = __ENV.TARGET_API_URL || 'http://toy-api:5000';
  
  // Scenario: Mix of chaotic endpoints
  const scenarios = [
    { name: 'Fast endpoint', url: `${baseUrl}/fast`, weight: 3 },
    { name: 'Slow endpoint', url: `${baseUrl}/slow`, weight: 2 },
    { name: 'Error prone', url: `${baseUrl}/error`, weight: 2 },
    { name: 'CPU intensive', url: `${baseUrl}/cpu`, weight: 1 },
  ];
  
  // Randomly select scenario based on weight
  const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;
  let selectedScenario = scenarios[0];
  
  for (const scenario of scenarios) {
    random -= scenario.weight;
    if (random <= 0) {
      selectedScenario = scenario;
      break;
    }
  }
  
  // Execute request
  const res = http.get(selectedScenario.url, {
    timeout: '5s',
    tags: { scenario: selectedScenario.name },
  });
  
  // Track metrics
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 3000ms': (r) => r.timings.duration < 3000,
  });
  
  errorRate.add(!success);
  if (res.status === 0 || res.timings.duration >= 5000) {
    timeoutRate.add(1);
  } else {
    timeoutRate.add(0);
  }
  
  // Random think time between 0.5-2 seconds
  sleep(0.5 + Math.random() * 1.5);
}
