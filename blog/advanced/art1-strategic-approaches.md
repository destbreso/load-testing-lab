# **Load Testing Lab – Strategic Approaches to Performance Engineering**

**Part of:** [Load Testing Lab Series](art0.md) | **Previous:** [← Basic Series](../basic/art3.md) | **Next:** [Architecture Deep Dive →](art1-architecture.md)

**Estimated reading time:** 18–22 minutes

---

> 💡 **About this article:** This article explores **advanced strategies and methodologies** for performance engineering using Load Testing Lab. If you're completely new, start with the [Basic Series](../basic/art1.md) first. This builds on basic concepts to discuss production scenarios, testing strategies, and real-world challenges that experienced engineers face.

## **Prerequisites**

- ✅ Completed [Basic Series](../basic/art1.md) (Articles 1-3)
- ✅ Understand fundamental load testing concepts
- ✅ Familiar with REST APIs and microservices architecture
- ✅ Have run at least 2-3 successful tests in the lab
- ✅ Comfortable reading Grafana dashboards

---

## **Beyond "Does It Work?" – The Performance Engineering Mindset**

The basic series taught you **how to run load tests**. This article teaches you **how to think strategically about performance**.

### **Three Levels of Performance Testing**

Most teams approach testing linearly, but experienced engineers work at three levels simultaneously:

**Level 1: Functional Load Testing** *(Does it work under load?)*
- Basic smoke tests with concurrent users
- Verify endpoints return correct responses
- Ensure no critical errors under normal load
- **Example:** 50 users hitting `/api/users` for 5 minutes

**Level 2: Capacity Planning** *(When will it break?)*
- Gradually increase load to find limits
- Identify bottlenecks (CPU, memory, database, network)
- Determine maximum sustainable throughput
- **Example:** Ramp from 10 to 500 users over 30 minutes, observe where degradation starts

**Level 3: Resilience Engineering** *(What happens when it breaks?)*
- Test failure scenarios deliberately
- Verify graceful degradation
- Validate circuit breakers and retry logic
- **Example:** Chaos testing with network failures, database outages

**The key insight:** You need all three levels to build truly production-ready systems. Most teams stop at Level 1 and wonder why production behaves differently.

---

## **Real-World Scenario: The E-Commerce Flash Sale**

Let me walk you through a scenario I've encountered multiple times in my career. This is based on real production incidents.

### **The Setup**

You're launching a flash sale for a popular product:

- 1000 units available
- Marketing campaign goes live at 12:00 PM sharp
- Expected traffic: 10,000+ simultaneous users in first 5 minutes
- Current infrastructure: 4 API servers, 1 PostgreSQL database, Redis cache

### **The Naive Approach (Level 1 Only)**

Many teams test like this:

```bash
# "Let's just test with 100 concurrent users for 5 minutes"
ltlab k6 -s checkout-flow.js --vus 100 --duration 5m
```

**Result:** All tests pass ✅  
**Metrics look great:** p95 latency 250ms, 0% errors

**Production outcome:** System crashes within 2 minutes of sale launch 💥

**What went wrong?**
- Tested constant load, not realistic spike pattern
- Didn't test database contention on inventory updates
- Didn't test cache invalidation patterns
- Assumed linear scalability (2x users = 2x load)
- Didn't account for thundering herd at sale start

### **The Strategic Approach (All 3 Levels)**

**Step 1: Functional Verification (Baseline)**

First, establish that the system works correctly under normal load:

```javascript
// scenarios/checkout-smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% requests under 500ms
    http_req_failed: ['rate<0.01'],     // <1% error rate
    checks: ['rate>0.99'],              // 99% checks pass
  },
};

export default function () {
  // View product
  let res = http.get('http://api/products/flash-sale-item');
  check(res, {
    'product loaded': (r) => r.status === 200,
    'has inventory': (r) => JSON.parse(r.body).stock > 0,
  });
  sleep(2);

  // Add to cart
  res = http.post('http://api/cart', JSON.stringify({
    productId: 'flash-sale-item',
    quantity: 1,
  }));
  check(res, {
    'added to cart': (r) => r.status === 200,
  });
  sleep(1);

  // Checkout
  res = http.post('http://api/checkout');
  check(res, {
    'checkout succeeded': (r) => r.status === 200,
    'inventory decremented': (r) => JSON.parse(r.body).success === true,
  });
}
```

**Result:** Baseline established - system works correctly at 50 concurrent users.

**Step 2: Capacity Planning (Find the Breaking Point)**

Now gradually increase load to find where it breaks:

```javascript
// scenarios/checkout-capacity.js
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Warm up
    { duration: '5m', target: 100 },   // Baseline
    { duration: '5m', target: 300 },   // 3x load
    { duration: '5m', target: 500 },   // 5x load
    { duration: '5m', target: 1000 },  // 10x load - will it survive?
    { duration: '2m', target: 0 },     // Cool down
  ],
  thresholds: {
    // More relaxed for capacity test
    http_req_duration: ['p(99)<2000'],
    http_req_failed: ['rate<0.10'],  // Allow up to 10% errors to see where it breaks
  },
};

export default function () {
  const res = http.post('http://api/checkout', JSON.stringify({
    productId: 'flash-sale-item',
  }));
  
  // Log failures for analysis
  if (res.status !== 200) {
    console.log(`[VU ${__VU}] Failed: ${res.status} - ${res.body}`);
  }
  
  sleep(1);
}
```

**Observations from Grafana:**

```
Time    VUs    p95 Latency  p99 Latency  Error Rate  Throughput
0-2m    100    280ms        450ms        0.0%        85 req/s   ✅
2-7m    100    290ms        480ms        0.0%        86 req/s   ✅
7-12m   300    520ms        890ms        0.1%        245 req/s  ⚠️
12-17m  500    1100ms       2300ms       2.5%        380 req/s  ⚠️
17-22m  1000   3400ms       timeout      18.0%       420 req/s  ❌
```

**Critical findings:**
- **Sweet spot:** 300 VUs (0.1% errors, acceptable latency)
- **Degradation starts:** 500 VUs (latency spikes, 2.5% errors)
- **Breaking point:** 1000 VUs (timeouts, 18% errors)
- **Throughput ceiling:** ~420 req/s (doesn't scale beyond 500 VUs)

**Bottleneck identified:** 
- Database connection pool maxed out at 50 connections
- Inventory update queries causing lock contention
- Cache miss rate increased from 5% to 45% under load

**Step 3: Resilience Testing (Realistic Spike Pattern)**

Now test the actual flash sale scenario - sudden spike:

```javascript
// scenarios/checkout-flash-sale.js
export const options = {
  scenarios: {
    // Normal background traffic
    background_traffic: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
      startTime: '0s',
    },
    
    // Flash sale spike (simulates email campaign hitting)
    flash_sale_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 800 },   // Sudden spike
        { duration: '4m', target: 800 },    // Sustain
        { duration: '1m', target: 200 },    // Gradual decline
      ],
      startTime: '3m',  // Spike happens 3 minutes in
      gracefulRampDown: '30s',
    },
    
    // Thundering herd (everyone refreshing at once)
    thundering_herd: {
      executor: 'shared-iterations',
      vus: 500,
      iterations: 500,  // Everyone makes 1 request immediately
      startTime: '3m',
      maxDuration: '10s',
    },
  },
  thresholds: {
    'http_req_duration{scenario:flash_sale_spike}': ['p(95)<1000'],
    'http_req_failed{scenario:flash_sale_spike}': ['rate<0.05'],
  },
};

export default function () {
  const res = http.post('http://api/checkout', JSON.stringify({
    productId: 'flash-sale-item',
  }));
  
  // Simulate user retry behavior
  if (res.status >= 500) {
    sleep(2);
    http.post('http://api/checkout', JSON.stringify({
      productId: 'flash-sale-item',
    }));
  }
  
  sleep(1);
}
```

**What this reveals:**
- **Cache stampede:** 500 simultaneous requests hit database when cache expires
- **Queue backup:** Async inventory update workers can't keep up
- **Database deadlocks:** 15% of transactions deadlock under contention
- **Circuit breaker triggers:** Good! System protecting itself from complete failure
- **Connection pool exhaustion:** New requests get "connection timeout" errors

### **The Solution (Based on Test Results)**

Armed with concrete data, we make informed decisions:

**1. Scale database layer:**
```yaml
# docker-compose.override.yml
services:
  postgres:
    environment:
      - POSTGRES_MAX_CONNECTIONS=200  # Was 50
      - POSTGRES_SHARED_BUFFERS=256MB  # Was 128MB
  
  postgres-replica:  # Add read replica
    image: postgres:15
    environment:
      - POSTGRES_REPLICA_MODE=true
```

**2. Implement inventory locking with Redis:**
```javascript
// Before: Race condition on inventory check
const product = await db.query('SELECT stock FROM products WHERE id = $1', [productId]);
if (product.stock > 0) {
  await db.query('UPDATE products SET stock = stock - 1 WHERE id = $1', [productId]);
}

// After: Atomic inventory decrement
const stock = await redis.decr(`inventory:${productId}`);
if (stock < 0) {
  await redis.incr(`inventory:${productId}`);  // Rollback
  throw new Error('Out of stock');
}
```

**3. Pre-warm caches before sale:**
```bash
# Warm up script (run 5 minutes before sale)
curl http://api/products/flash-sale-item  # Populates cache
redis-cli SET "inventory:flash-sale-item" 1000
```

**4. Add rate limiting per user:**
```javascript
// Express middleware
const rateLimit = require('express-rate-limit');

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,  // Max 10 checkout attempts per minute per IP
  message: 'Too many checkout attempts, please try again later',
});

app.post('/api/checkout', checkoutLimiter, async (req, res) => {
  // ... checkout logic
});
```

**5. Implement graceful queue shedding:**
```javascript
// Worker process
const MAX_QUEUE_SIZE = 1000;

if (queue.length > MAX_QUEUE_SIZE) {
  // Shed load - return 503 instead of queuing
  return res.status(503).json({
    error: 'System at capacity, please try again in 30 seconds',
    retryAfter: 30,
  });
}
```

**Step 4: Validate the Solution**

Rerun the same tests with changes applied:

```
Test: Flash Sale Spike (800 concurrent users)

BEFORE:
- p95 latency: 3400ms
- p99 latency: timeout
- Error rate: 18%
- Throughput: 420 req/s (ceiling)
- Result: FAIL ❌

AFTER:
- p95 latency: 620ms  (-82%)
- p99 latency: 980ms
- Error rate: 0.5%    (-97%)
- Throughput: 780 req/s (+86%)
- Result: PASS ✅
```

**Production outcome:** 
- Flash sale completes successfully
- 987/1000 units sold in 8 minutes
- Only 13 units lost to race conditions (acceptable)
- Average checkout time: 450ms
- Customer complaints: 3 (vs projected 100+)
- **Business impact:** $47,000 revenue, happy customers, positive brand perception 🎉

---

## **Strategic Testing Framework**

### **The Testing Pyramid for Performance**

Traditional testing pyramid (unit → integration → e2e) doesn't apply well to performance. Here's the performance testing pyramid:

```
                    ┌────────────────────┐
                    │ Chaos Engineering  │  ← Level 3: Resilience
                    │ (Weekly/Bi-weekly) │     What happens when things fail?
                    │                    │     How do we recover?
                    └────────────────────┘
                            ▲
                            │
                    ┌────────────────────┐
                    │ Capacity Planning  │  ← Level 2: Limits
                    │ (Monthly/         │     When do we break?
                    │  After big changes)│     What's our ceiling?
                    └────────────────────┘
                            ▲
                            │
                    ┌────────────────────┐
                    │  Load Smoke Tests  │  ← Level 1: Functional
                    │  (Every PR merge)  │     Does it work under load?
                    │                    │     Any regressions?
                    └────────────────────┘
```

**Recommended frequency:**
- **Smoke tests:** Every PR merge (automated in CI/CD)
- **Capacity planning:** Monthly or after major architectural changes
- **Chaos engineering:** Weekly sprints or before major releases

**Time investment:**
- Smoke: 5-10 minutes
- Capacity: 30-60 minutes
- Chaos: 2-4 hours

### **Question-Driven Testing Methodology**

Stop thinking "let's run a load test." Start asking specific, measurable questions.

| Business Question | Technical Question | Test Pattern | k6 Executor |
|-------------------|-------------------|--------------|-------------|
| Can we handle Black Friday? | What happens with 10x normal traffic? | Spike test | `ramping-arrival-rate` |
| What's our infrastructure cost at scale? | What's max throughput per server? | Stress test | `ramping-vus` until failure |
| Will we stay up during outages? | Do we degrade gracefully? | Breakpoint test | Gradual increase + monitoring |
| Can we survive database failure? | Do fallbacks work? | Chaos test | Inject failures with scenarios |
| Is caching worth the complexity? | Cache hit rate impact? | A/B comparison | Two scenarios (cached/non-cached) |
| Do background jobs cause issues? | Do workers keep up with queues? | Soak test | Sustained load for hours |
| Are SLOs achievable? | Can we meet 99.9% uptime? | SLO validation | Sustained load + threshold checks |

**Example: Testing cache effectiveness**

**Question:** "Is our caching strategy reducing database load?"

**Test:**

```javascript
import http from 'k6/http';
import { group } from 'k6';

export const options = {
  vus: 100,
  duration: '10m',
};

export default function () {
  // Scenario A: With cache
  group('cached_endpoint', () => {
    http.get('http://api/products?cache=enabled');
  });
  
  // Scenario B: Without cache (bypasses cache layer)
  group('uncached_endpoint', () => {
    http.get('http://api/products?cache=disabled');
  });
}
```

**Expected results in Grafana:**

```
Metric              Cached    Uncached   Improvement
─────────────────────────────────────────────────────
p50 latency         45ms      380ms      88% faster
p95 latency         78ms      820ms      90% faster
p99 latency         120ms     1500ms     92% faster
Database queries    5/sec     95/sec     95% reduction
```

**Conclusion:** 
- Caching provides 88-92% latency improvement ✅
- Database load reduced by 95% ✅
- **Decision:** Keep caching strategy, worth the complexity

---

## **Advanced Testing Patterns**

### **Pattern 1: Realistic User Behavior Simulation**

**The problem with naive testing:**

```javascript
// ❌ Bad: Unrealistic hammer pattern
export default function () {
  http.get('http://api/products');
  // Immediately repeats - no human behaves like this
}
```

**Why this is bad:**
- Unrealistic request distribution
- Cache hit rates don't match production
- Database query patterns are wrong
- Hides real-world latency issues

**Good approach - Simulate actual user journey:**

```javascript
// ✅ Good: Realistic user behavior
import http from 'k6/http';
import { sleep, check } from 'k6';

export default function () {
  // 1. User lands on homepage (from Google/social media)
  let res = http.get('http://api/products');
  check(res, { 'homepage loaded': (r) => r.status === 200 });
  sleep(randomBetween(2, 5));  // User browses product grid
  
  // 2. User clicks on product (30% bounce rate)
  if (Math.random() > 0.3) {
    const productId = Math.floor(Math.random() * 1000) + 1;
    res = http.get(`http://api/products/${productId}`);
    check(res, { 'product loaded': (r) => r.status === 200 });
    sleep(randomBetween(5, 15));  // User reads description, reviews
    
    // 3. User adds to cart (20% conversion from view)
    if (Math.random() < 0.2) {
      res = http.post('http://api/cart', JSON.stringify({
        productId,
        quantity: 1,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      check(res, { 'added to cart': (r) => r.status === 200 });
      sleep(randomBetween(1, 3));  // User reviews cart
      
      // 4. User proceeds to checkout (50% cart abandonment)
      if (Math.random() < 0.5) {
        res = http.post('http://api/checkout', JSON.stringify({
          paymentMethod: 'credit_card',
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
        check(res, { 'checkout completed': (r) => r.status === 200 });
        sleep(1);
      } else {
        // User abandons cart
        sleep(1);
      }
    }
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
```

**Why this is better:**
- Matches real conversion funnel (100% → 70% → 14% → 7%)
- Realistic cache patterns (homepage cached, product pages vary)
- Database query distribution matches production
- Reveals actual bottlenecks in user journey
- Think time prevents unrealistic request bursts

**Metrics comparison:**

```
Pattern         Avg Latency  p95 Latency  DB Load   Realistic?
─────────────────────────────────────────────────────────────
Hammer pattern  120ms        180ms        100%      ❌ No
User journey    280ms        650ms        35%       ✅ Yes
```

The user journey pattern has higher latency because it tests the full stack, including slow endpoints (checkout). This is what you want!

---

### **Pattern 2: Data-Driven Load Testing**

**The problem:** Using fake/static data doesn't test realistic scenarios.

**Example of the problem:**

```javascript
// ❌ Bad: Always tests same user
export default function () {
  http.get('http://api/users/123/orders');
  // User 123 always has same order history
  // Database caches this query
  // Doesn't test index performance on varied data
}
```

**Solution:** Use production-like data distribution.

**Step 1: Export user IDs from production** (anonymized)

```bash
# Export to CSV (run on prod database)
psql -c "COPY (SELECT id FROM users TABLESAMPLE SYSTEM (10)) TO STDOUT CSV" > users.csv
```

**Step 2: Load data in k6 scenario**

```javascript
import { SharedArray } from 'k6/data';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';
import http from 'k6/http';

// Load CSV once, shared across all VUs (memory efficient)
const userData = new SharedArray('users', function () {
  const csvData = open('./data/users.csv');
  return papaparse.parse(csvData, { header: true }).data;
});

export default function () {
  // Random user from dataset
  const user = userData[Math.floor(Math.random() * userData.length)];
  
  // Test with real user ID
  const res = http.get(`http://api/users/${user.id}/orders`);
  
  // Some users have many orders, some have few
  // Tests realistic query patterns and index usage
}
```

**Step 3: Use weighted distribution for realistic scenarios**

```javascript
// Realistic user behavior distribution
const userTypes = [
  { type: 'power_user', weight: 5, orders_per_session: 5 },
  { type: 'regular_user', weight: 20, orders_per_session: 2 },
  { type: 'casual_user', weight: 75, orders_per_session: 1 },
];

export default function () {
  const userType = weightedRandom(userTypes);
  
  for (let i = 0; i < userType.orders_per_session; i++) {
    http.get(`http://api/users/${getRandomUser()}/orders`);
    sleep(randomBetween(2, 5));
  }
}

function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    if (random < item.weight) return item;
    random -= item.weight;
  }
  return items[items.length - 1];
}
```

**Benefits of data-driven testing:**
- Tests actual database indexes
- Reveals hot partitions and skewed data
- Validates query performance on real data distribution
- Discovers edge cases (null values, large arrays, etc.)
- Cache hit rates match production

---

### **Pattern 3: Progressive Failure Injection**

**Goal:** Find the exact breaking point without immediately crashing the system.

**Strategy:** Gradually increase load while monitoring multiple metrics.

```javascript
// scenarios/progressive-stress.js
import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics to track degradation
const slowRequests = new Counter('slow_requests');
const verySlowRequests = new Counter('very_slow_requests');
const latencyTrend = new Trend('custom_latency');

export const options = {
  stages: [
    { duration: '5m', target: 100 },   // Baseline
    { duration: '5m', target: 200 },   // 2x
    { duration: '5m', target: 400 },   // 4x
    { duration: '5m', target: 800 },   // 8x - should show degradation
    { duration: '5m', target: 1600 },  // 16x - likely breaks
    { duration: '2m', target: 0 },     // Cool down
  ],
  thresholds: {
    // Don't fail test immediately - want to see full failure progression
    http_req_failed: ['rate<0.5'],  // Allow up to 50% errors
    http_req_duration: ['p(99)<10000'],  // Very generous - want to see behavior
  },
};

export default function () {
  const startTime = Date.now();
  const res = http.get('http://api/heavy-endpoint');
  const duration = Date.now() - startTime;
  
  latencyTrend.add(duration);
  
  // Track degradation levels
  if (duration > 1000) slowRequests.add(1);
  if (duration > 5000) verySlowRequests.add(1);
  
  // Detailed failure logging
  if (res.status !== 200) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      vu: __VU,
      iter: __ITER,
      status: res.status,
      duration: duration,
      error: res.error || 'none',
      body: res.body.substring(0, 100),  // First 100 chars
    }));
  }
  
  check(res, {
    'status 200': (r) => r.status === 200,
    'latency < 2s': () => duration < 2000,
  });
  
  sleep(1);
}
```

**What to look for in Grafana:**

```
Time    VUs    p50    p95     p99      Error%  Notes
──────────────────────────────────────────────────────────────
0-5m    100    120ms  250ms   450ms    0.0%    ✅ Baseline normal
5-10m   200    180ms  380ms   720ms    0.0%    ✅ Still healthy
10-15m  400    320ms  680ms   1400ms   0.2%    ⚠️  Starting to degrade
15-20m  800    890ms  2100ms  4500ms   3.8%    ❌ Significant degradation
20-25m  1600   timeout timeout timeout 47.0%   ❌ System breaking
```

**Key insights from this test:**
- **Sweet spot:** 200-300 VUs (minimal degradation)
- **Degradation threshold:** 400 VUs (latency doubles, errors appear)
- **Breaking point:** 800 VUs (system struggling but not dead)
- **Failure mode:** 1600 VUs (majority of requests fail)

**What the logs reveal:**

```json
// At 800 VUs - errors starting
{"timestamp":"2024-01-15T14:23:45Z","status":503,"error":"Service Unavailable","note":"Circuit breaker open"}
{"timestamp":"2024-01-15T14:23:47Z","status":504,"error":"Gateway Timeout","note":"Upstream timeout"}

// At 1600 VUs - system collapsing
{"timestamp":"2024-01-15T14:28:12Z","status":0,"error":"dial tcp: lookup api: no such host","note":"DNS resolution failing"}
{"timestamp":"2024-01-15T14:28:13Z","status":0,"error":"connection refused","note":"Service not accepting connections"}
```

---

### **Pattern 4: Mixed Workload Testing**

**Reality:** Production isn't homogeneous. You have fast endpoints, slow endpoints, heavy queries all happening simultaneously.

**Problem with single-endpoint testing:**

```javascript
// ❌ Unrealistic: Only tests one endpoint
export default function () {
  http.get('http://api/products');  // Fast cached endpoint
}
```

**This misses:**
- Thread pool contention between fast and slow requests
- Database connection competition
- Memory pressure from heavy queries
- Queue backup from async operations

**Solution: Test realistic traffic mix**

```javascript
// scenarios/mixed-workload.js
export const options = {
  scenarios: {
    // 50% of traffic: Fast cached reads
    fast_reads: {
      executor: 'constant-arrival-rate',
      rate: 100,  // 100 req/s
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 20,
      maxVUs: 100,
      exec: 'fastEndpoint',
    },
    
    // 30% of traffic: Standard database queries
    standard_reads: {
      executor: 'constant-arrival-rate',
      rate: 60,  // 60 req/s
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 30,
      maxVUs: 150,
      exec: 'standardEndpoint',
    },
    
    // 15% of traffic: Slow writes with validation
    slow_writes: {
      executor: 'constant-arrival-rate',
      rate: 30,  // 30 req/s
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 40,
      maxVUs: 200,
      exec: 'slowEndpoint',
    },
    
    // 5% of traffic: Heavy analytics queries
    heavy_queries: {
      executor: 'constant-arrival-rate',
      rate: 10,  // 10 req/s
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 20,
      maxVUs: 100,
      exec: 'heavyEndpoint',
    },
  },
};

export function fastEndpoint() {
  // Cached product catalog - should be < 50ms
  http.get('http://api/products');
}

export function standardEndpoint() {
  // User profile lookup - typical database query ~200ms
  const userId = Math.floor(Math.random() * 10000);
  http.get(`http://api/users/${userId}`);
}

export function slowEndpoint() {
  // Order creation with validation - ~500ms
  http.post('http://api/orders', JSON.stringify({
    userId: Math.floor(Math.random() * 10000),
    items: [{ productId: 123, quantity: 1 }],
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export function heavyEndpoint() {
  // Analytics report generation - 2-5 seconds
  http.get('http://api/analytics/report?range=30d');
}
```

**What this reveals:**

```
Observation                          Impact
──────────────────────────────────────────────────────────────
Heavy queries block fast endpoints   Thread pool exhaustion
Writes cause read latency spikes     Database lock contention
Analytics queries consume memory     OOM after 30 minutes
Async job queue backs up             Workers can't keep up
```

**Example finding:**

"Heavy analytics queries (5% of traffic) were consuming 40% of database connections and causing p95 latency on fast endpoints to spike from 50ms to 800ms."

**Solution:** 
- Move analytics queries to read replica
- Implement connection pool prioritization
- Add query timeout (5s max for analytics)
- Use materialized views for common reports

---

(Continuing in next message due to length...)
