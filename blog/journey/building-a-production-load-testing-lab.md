# Building a Production Load Testing Lab: A Developer's Journey

I want to tell you about a problem I had, and how solving it turned into building something I wish had existed when I started.

---

## It Started With Questions I Couldn't Answer

Picture this: you're building a system that talks to multiple LLM providers. OpenAI for some requests, Anthropic for others, maybe some local models mixed in. Users expect real-time streaming responses. Your product manager is asking about capacity planning for next quarter. Your CFO wants cost projections.

And then you realize: you have no idea how to answer any of their questions with confidence.

Sure, I knew what OpenAI's documentation said about rate limits. I could calculate theoretical token costs. But that's not what keeps you up at night when you're preparing for production. What kept me up was wondering: what happens when 50 real users hit my system at the same time? Not in a controlled test environment with perfect conditions, but in the messy reality of production where requests come in bursts, users have different patterns, and network conditions vary.

The questions I needed answers to weren't in any vendor documentation. They were operational questions that emerge from the specific architecture I'd built. How does my service degrade when concurrent load increases? At what point does latency become unacceptable for users? Which LLM provider actually performs better for my specific use case under load? And perhaps most importantly: what's my realistic monthly cost going to be if my user base grows by 3x?

These questions matter because they determine whether your architecture is sound, whether your business model works, and whether you're going to have a very bad day three months from now when traffic spikes.

---

## The Search for Solutions (That Didn't Quite Fit)

So I did what any developer does: I started looking for existing solutions. Surely someone had solved this already, right?

### Cloud-Based Load Testing: Expensive Simplicity

The cloud platforms promised simplicity. "No infrastructure needed! Just write your tests and run them!" The demos looked great. But when I actually tried to use them for my needs, reality set in fast.

First, the cost. These platforms are priced for quick validation tests, not for the kind of extended testing campaigns I needed. I wasn't trying to validate a simple API endpoint. I needed to run scenarios for hours, simulating realistic user behavior patterns, testing different provider configurations, understanding degradation curves. The bills added up quickly.

Second, and more fundamental: my system wasn't just a public API. I had local model endpoints I wanted to test. Internal services. Development environments that weren't exposed to the internet. The cloud testing platforms couldn't reach them, and the workarounds felt hacky and insecure.

But the deal-breaker was the dashboards. They were generic, designed for generic web applications. They tracked requests per second and error rates, which is fine, but they didn't help me answer my specific questions. I couldn't easily track token consumption patterns. I couldn't compare provider-specific latencies. I couldn't visualize how my system degraded under specific load patterns that mattered to my use case.

### DIY Scripts: Flexibility Without Visibility

Maybe I should just write my own scripts? Python's `requests` library is straightforward. I could simulate load, log timestamps, calculate some metrics. Total control, zero cost.

Except... have you ever tried to make sense of load test results from log files? It's fine for a single run, but when you're iterating, testing different scenarios, comparing results across days, it becomes a mess. I found myself constantly writing one-off scripts to parse logs, generate graphs, calculate percentiles. Each question required new code.

And the worst part: no real-time visibility. I'd start a test, wait for it to complete, then spend time analyzing the results, only to realize I should have adjusted something five minutes into the test. No live dashboards meant no ability to react during a test run.

The approach worked, technically. But it didn't scale with the complexity of what I was trying to understand.

### The Multi-Project Problem: One Stack Per Project?

And then there was the elephant in the room that nobody seemed to talk about: what happens when you have multiple projects?

I wasn't working on just one API. I had the LLM service, sure. But I also had a payment processing API. A user authentication service. A fleet management backend. Each needed load testing. Each had different performance characteristics, different endpoints, different concerns.

The "obvious" solution was to set up a load testing stack for each project. k6, InfluxDB, Grafana, configuration files—duplicated into each repository. But this created its own nightmare:

- **Configuration drift**: Each stack evolved independently. Bug fixes in one weren't propagated to others. Dashboard improvements stayed local.
- **Onboarding friction**: New team members had to learn the setup for each project. "Oh, the payment API uses a slightly different Grafana version."
- **Maintenance overhead**: Updating InfluxDB meant updating it in five places. Upgrading Grafana meant five upgrades. Each with its own configuration quirks.
- **Wasted resources**: Running multiple InfluxDB and Grafana instances when you're only testing one project at a time.

What I really wanted was simple: **one lab, many projects**. A single, well-maintained load testing environment that I could point at any project. The infrastructure stays in one place. The test scenarios and dashboards live with each project. When I switch from testing the payment API to testing the fleet management service, I don't reconfigure anything—I just point the lab at different test files.

### Source of Truth: Where Should Tests Live?

This led me to a deeper architectural question: where should the test code actually live?

The traditional approach puts everything in the testing tool. Your load testing repo contains all scenarios for all projects. But this creates a strange coupling. The payment API team needs to make changes to the load testing repo to update their tests. The fleet management team does too. Suddenly everyone is committing to the same repo, dealing with merge conflicts, coordinating releases.

The alternative is cleaner: **each project is the source of truth for its own tests**.

Think about it:
- The payment API team knows their API best. They should own their load test scenarios.
- When they add a new endpoint, they add the corresponding test in the same PR.
- Their custom dashboards live alongside their code, versioned together.
- The load testing lab is just infrastructure—like Docker or CI runners.

This separation has a beautiful property: **complexity is decoupled**.

- Want to improve the lab? Update it once, everyone benefits.
- Want to improve your project's tests? Update them in your repo, no coordination needed.
- New team member joins? They learn the lab once, then find project-specific tests where they expect them—in the project.

It's the same principle as keeping your Dockerfile in your project repo, not in a central "all Dockerfiles" repo. The infrastructure tool is generic; the configuration is specific to each use case.

This became a core design goal that shaped the final architecture. The lab would be a shared tool, not embedded infrastructure. Projects would bring their own scenarios and dashboards, and the lab would run them without needing per-project setup.

### Industry Standard Tools: Powerful But Scattered

Then there's k6 and Artillery. These are genuinely good tools. The load testing community swears by them for good reasons. They're powerful, flexible, battle-tested in production.

But here's what the tutorials don't tell you: getting from "install k6" to "understand what's happening in my system" is a journey. You need k6. Then you need somewhere to store the metrics, so you set up InfluxDB. But which version? InfluxDB v1 and v2 are different beasts. Okay, InfluxDB v2 it is. Now you need to configure k6 to send metrics there. Oh, but k6 doesn't support InfluxDB v2 out of the box, you need an extension. Time to learn about xk6 and recompile k6 with the extension.

### The Obvious Solution: Just a Docker Compose?

At this point, you might be thinking: "Why not just create a docker-compose.yml with all the services? Problem solved."

And you'd be right. That's the logical first approach. Wire up k6, InfluxDB, Grafana in a compose file, mount some volumes, done. I considered stopping there.

In fact, I *did* stop there for years. I had a docker-compose setup that worked. When I needed load testing, I'd spin it up, run some tests, look at dashboards, shut it down. It solved the problem.

But here's what I noticed over time: every time I came back to it after a few months, I had to re-learn it. How did I run tests again? What was the Grafana password? Which dashboard showed what I needed? The compose file worked, but my memory didn't persist between uses.

And when I wanted to test a new project, or try a new dashboard, or onboard a teammate, the friction was real:

- "Let me remember how this works..."
- "Where did I put those example scenarios?"
- "Was this the right InfluxDB query syntax?"
- "Why isn't data showing up? Is it my test or the infrastructure?"

A bare docker-compose.yml leaves you with these problems:

- **How do you know it works?** You need something to test against. Your real API? That defeats the purpose of having an isolated lab.
- **How do you learn the tools?** You have infrastructure, but no examples. Every test you write is from scratch.
- **How do you onboard teammates?** "Here's the docker-compose, good luck figuring out how to use it."
- **How do you verify the dashboards?** Grafana is running, but are the queries correct? Is data actually flowing?
- **How do you remember it after 3 months?** You become your own new teammate, needing onboarding again.

What I ended up building is that docker-compose solution, but **with steroids**:

✅ **Toy API included** – 8 endpoints to test the stack, verify dashboards, and learn patterns  
✅ **Ready-to-run scenarios** – Dozens of k6 and Artillery examples you can use immediately  
✅ **Pre-configured dashboards** – 6 professional Grafana dashboards, tested and working  
✅ **CLI for ergonomics** – `ltlab start` instead of remembering docker-compose flags  
✅ **Extensive documentation** – 13-article course, troubleshooting guides, everything in one place  
✅ **External project support** – Use with any project without copying files  

The toy API alone changes everything. It's not just for testing—it's for *teaching*. New team member? "Run `ltlab k6 -s toy-fast.js` and look at the dashboard." Want to try a new dashboard panel? Test it against `/slow` or `/cpu`. Debugging why metrics aren't flowing? The toy API eliminates your application as a variable.

So yes, at its core it's a docker-compose stack. But the value is in everything around it: the examples, the documentation, the CLI, the toy API. It's the difference between handing someone a toolkit and handing them a workshop.

Now you have data flowing. But you want to see it, so you add Grafana. More configuration. Datasource setup. Dashboard creation. Learning Flux query language because InfluxDB v2 doesn't use SQL. Each step is documented somewhere, but you're stitching together knowledge from different sources, different versions, different assumptions about your setup.

And then there's Artillery. Great tool, different approach than k6, useful for certain scenarios. But it doesn't talk to InfluxDB v2 at all. Now you're researching plugins, finding out most support InfluxDB v1, learning about Telegraf as a bridge...

None of this is impossible. Individually, each piece makes sense. But the cognitive load of understanding how all these pieces fit together, configuring them correctly, and then actually using them to answer your questions? It's significant. And when something breaks, or when dashboards show no data (more on that later), debugging spans multiple technologies you've just learned.

I realized that the tools existed, but the integrated experience I needed didn't. What I really wanted was a lab, not just tools. A place where I could run experiments, see results immediately, iterate quickly, and focus on understanding my system instead of configuring infrastructure.

---

## Defining What "Done" Actually Means

Before writing any code, I needed to be clear about what success looked like. Not in abstract terms like "a good load testing setup," but in concrete, measurable outcomes. What would this lab need to do for me to consider it useful?

### Understanding Service Degradation

I needed to see how my system behaves as load increases. Not just "it crashes at X requests per second," but the nuanced story of degradation. Where does latency start creeping up? At what point does the p95 latency (the experience for the slowest 5% of users) become unacceptable? Are there cliff edges where performance suddenly drops, or does it degrade gradually?

This meant I needed scenarios that could gradually ramp up load, real-time tracking of latency percentiles, and visual dashboards that would let me spot the inflection points. I needed to correlate what I was seeing in my dashboards with what was happening at the provider level.

### Comparing Apples to Apples

My system used multiple LLM providers. Each had different characteristics, different pricing models, different performance profiles. But comparing them fairly was harder than it sounds. Provider A might have better average latency, but Provider B might be more consistent under load. How do you make that comparison meaningful?

I needed the ability to run the same test scenarios against different providers, collect normalized metrics, and display them side by side. Not just technical metrics like requests per second, but business metrics like cost per request and failure rates under specific load patterns.

### Projecting Real Costs

This was crucial. The CFO's question about costs wasn't hypothetical. If our user base grew to 10,000 active users, each making an average of 5 requests per day, with typical session patterns, what would our provider bills look like? Not the theoretical "cost per token" math, but the realistic cost accounting for retries, errors, variable request sizes, and peak usage patterns.

This required modeling realistic user behavior, not just hammering endpoints. Think time between requests, session duration, the distribution of request types. And then tracking not just raw request counts but token consumption, which is what you actually pay for with LLMs.

### Planning for Growth

The capacity planning question was perhaps the most important. Our current infrastructure handled current load fine. But what would break first when traffic doubled? Tripled? Was it our application servers? The database? Network bandwidth? Or would we hit API rate limits from our providers first?

I needed sustained load tests that could run for hours, correlation between my infrastructure metrics (CPU, memory, database connections) and external factors (API quotas, rate limits), and clear identification of bottlenecks. Not "your system can handle X requests per second" but "at your current growth rate, you'll need to scale Y in approximately Z months."

### The User Experience Requirement

Here's the thing that tied it all together: this needed to work on the first try. If setting up the lab required a weekend of reading documentation and debugging configuration issues, I'd never use it. And more importantly, my teammates wouldn't use it either.

It had to be: clone the repository, run one command, and have a working environment. Tests should produce visible results immediately. Dashboards should load automatically. When something went wrong, the error messages should tell you what to fix and how to fix it.

This wasn't about dumbing things down. It was about removing accidental complexity so I could focus on the essential complexity of understanding my system's behavior.

---

## Building the Foundation: Architecture Decisions

With the requirements clear, I started making the fundamental architectural decisions. Each choice had trade-offs, and I want to walk you through the reasoning.

### Docker Compose Over Kubernetes

The first decision was about orchestration. Should this be a Kubernetes deployment? It would look impressive, and Kubernetes is what you'd use for a production monitoring stack at scale. But I kept coming back to the user experience requirement.

My target user (which included future me) needed something that worked immediately. Kubernetes meant kubectl, cluster setup, understanding namespaces and services. Docker Compose meant `docker-compose up`. The choice was obvious. This wasn't about building something that could scale to monitor thousands of applications; it was about creating a lab environment that anyone could spin up on their laptop.

Docker Compose also meant that every component's configuration was visible in one file. Want to understand how Grafana connects to InfluxDB? It's right there in the docker-compose.yml. No hidden Kubernetes secrets, no service mesh complexity. Transparency over sophistication.

### InfluxDB v2 for Time-Series Data

Metrics from load tests are inherently time-series data. You care about how latency changes over time, how request rates evolve, when errors spike. This isn't a job for PostgreSQL or MongoDB. You need a time-series database.

InfluxDB v2 was a natural choice, but not without considerations. InfluxDB v1 had more existing tooling, more tutorials, more StackOverflow answers. But InfluxDB v2 was the future. It had better performance, more mature APIs, and Flux query language which, while having a learning curve, was far more powerful for the kind of data analysis I needed.

The decision to use v2 meant I'd hit some rough edges. k6 didn't support it natively. Artillery had no plugins for it. But starting with the right foundation meant these were solvable problems, not architectural regrets.

### Pre-Compiled k6 with xk6-influxdb

Here's where things got interesting. k6 is fantastic, but getting it to work with InfluxDB v2 requires the xk6-influxdb extension. Which means users would need to install Go, learn about xk6 build tools, compile a custom k6 binary... or I could do that once and include it in the Docker image.

This was a key insight: what's complex to set up once can be simple to use many times. I spent an evening figuring out the xk6 build process, writing a Dockerfile that compiled k6 with the right extensions, and then users would never need to think about it. They'd just use k6, and it would work with InfluxDB v2 automatically.

This pattern of "absorb complexity in the build, present simplicity in the interface" became a recurring theme.

### The Telegraf Bridge for Artillery

Artillery and InfluxDB v2 didn't speak the same language. Artillery could emit StatsD metrics, but InfluxDB v2's API was HTTP-based. I had three options: write a custom Artillery plugin to speak InfluxDB v2's API directly, parse Artillery's logs after tests ran, or introduce Telegraf as a translator.

Writing a custom plugin would give the cleanest architecture on paper. But it would also mean maintaining that plugin, keeping up with Artillery updates, debugging issues that span both codebases. It was complexity I'd own forever.

Parsing logs post-test eliminated the real-time visibility that was a core requirement. No live dashboards meant no ability to observe and react during tests.

Telegraf was the pragmatic choice. It's battle-tested infrastructure that enterprises use in production. It speaks StatsD natively and InfluxDB v2 natively. It handles buffering, retries, and aggregation. Adding Telegraf as a service meant one more container, but it also meant leveraging a robust, maintained solution instead of building one myself.

The architecture became: Artillery emits StatsD metrics over UDP, Telegraf receives them, aggregates them, and forwards them to InfluxDB v2. Artillery didn't need to know InfluxDB existed. InfluxDB didn't need to speak StatsD. Telegraf was the adapter pattern in infrastructure form.

### Grafana Dashboards: Six, Not One

I could have created one general-purpose dashboard. "Here's your load testing metrics." But different questions need different views.

When you're in the middle of a load test watching for problems, you need a war room dashboard. High-level metrics, large fonts, real-time updates every few seconds. Is the system healthy? Are errors spiking? This is the dashboard you put on a big screen.

When you're analyzing test results afterward, you need different tools. More metrics, smaller visualizations, the ability to correlate things. You want to see detailed breakdowns, percentile distributions, trend lines. This is the pro dashboard for deep analysis.

And between these extremes, there's the elite dashboard. More than war room, less overwhelming than pro. This is what I found myself using day-to-day.

So I built six dashboards: three for k6 (war room, elite, pro), three for Artillery (same pattern). Each optimized for its use case. This sounds like more work, but in practice, it meant each dashboard could be focused and useful instead of trying to be everything to everyone.

### Configuration Through Environment Variables

Every service needed configuration: InfluxDB needed an organization name and bucket name, Grafana needed to know where InfluxDB was, k6 and Artillery needed authentication tokens. Hard-coding these values would work but wouldn't be flexible. Exposing them as environment variables meant users could customize without touching Docker configurations.

The .env file became the single source of truth:

```env
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=loadtests
INFLUXDB_TOKEN=admin123
```

Every service read from these variables. Change the file, restart the stack, new configuration. No hunting through multiple config files, no inconsistencies between services.

### The Toy API: A Decision That Changed Everything

Early in development, I hit a wall that taught me an important lesson about debugging complex systems. I had my lab infrastructure set up, or so I thought. I ran my first test against my real LLM service. Nothing worked. Metrics weren't appearing. Dashboards were empty. And I had no idea where the problem was.

Was it k6's configuration? Was InfluxDB not receiving data? Was Grafana misconfigured? Or was my actual API behaving unexpectedly under load? Too many variables. Too many potential failure points. I was debugging in the dark.

That's when I realized I needed to reduce the surface area of failure. I needed something I could control completely, something predictable, something that would let me verify the infrastructure was working before I pointed it at real services. I needed a toy API.

The toy API started as a simple Express application with a few endpoints: `/fast` (returns immediately), `/slow` (adds artificial delay), `/cpu` (does computation), `/io` (simulates I/O operations), `/error` (returns errors at a configurable rate). Nothing fancy, just enough to generate predictable behavior I could test against.

With the toy API in place, debugging became manageable. If a test against `/fast` didn't show metrics in Grafana, the problem wasn't with my LLM service; it was with the lab infrastructure. I could isolate issues. k6 configuration problems became obvious when tests failed against a trivial endpoint. InfluxDB connection issues showed up immediately instead of hiding behind application-specific behavior.

But something interesting happened as I refined the toy API to test different aspects of the lab. It became more than just a debugging tool. It became a teaching tool.

When I wanted to demonstrate load testing concepts to teammates, I didn't need to spin up our complex production-like environment. I could show them the toy API. "Here's what happens when you test a fast endpoint versus a slow one. Here's how error rates affect your metrics. Here's what CPU-bound operations look like under load." All with a simple, reproducible setup they could run on their laptops.

When I wrote the tutorial series for this lab, the toy API made everything possible. I couldn't tell readers "now test against my private LLM service." But I could tell them "run this command against the toy API's `/cpu` endpoint and you'll see this exact pattern in the dashboard." Every example became reproducible. Every tutorial became self-contained. The quick start guide worked because anyone could run the same tests against the same predictable API and see the same results.

And then I realized something that changed my perspective on the entire project: the toy API made the lab general-purpose.

I had built this lab specifically for my LLM service evaluation needs. It was opinionated, tailored to my exact problem. But the toy API abstracted away the specifics. If you were testing a different kind of service, you could start with the toy API to learn the lab, understand the patterns, see how metrics flow. Then you'd adapt those patterns to your own API.

The toy API became a bridge between "this is a specialized tool for LLM testing" and "this is a general load testing platform you can adapt." It wasn't designed to be general from the start. It became general because the toy API provided a universal interface for learning and testing.

This was one of the key reasons I decided to open source the project. Originally, I thought the lab was too specific to my use case to be useful to others. But the toy API changed that calculation. Someone testing a REST API could use it. Someone testing a GraphQL service could adapt it. Someone learning load testing for the first time had a safe sandbox to experiment in.

The toy API meant the lab could serve multiple purposes. It was a debugging tool when I needed to verify infrastructure. It was a learning tool when I needed to understand concepts. It was a demonstration tool when I needed to teach others. And it was an abstraction that made the lab applicable beyond its original narrow use case.

If I were giving advice to someone building developer tools, this would be high on the list: build a toy version of what you're working with. Not as a toy project, but as a controlled environment within your real project. It reduces debugging complexity, enables reproducible examples, and often reveals how to make your specialized tool more general without sacrificing its core purpose.

---

## The Problems You Only Find When Things Should Work

With the architecture in place and the initial implementation done, I did what any developer does: I ran a test to see if it worked. It didn't. Well, parts of it worked, but in that frustrating way where everything seems fine until you actually look at the results.

### The Case of the Missing k6 Metrics

The first test looked successful. I ran a k6 scenario, watched the terminal output showing requests flying, saw that beautiful summary at the end with request rates and latency percentiles. Perfect. Time to check the Grafana dashboard.

Empty. Completely empty. No data.

Okay, maybe Grafana takes a moment to refresh? Nope, still empty five minutes later. Maybe I misconfigured the datasource? I manually queried InfluxDB using their web UI. The bucket existed, but it was empty. So k6 never sent the data to InfluxDB.

Here's where I learned something about Docker Compose that isn't obvious from the documentation. Environment variable expansion doesn't work the way you might think. I had configured k6 like this:

```yaml
environment:
  - K6_OUT=xk6-influxdb=http://influxdb:8086?org=${INFLUXDB_ORG}&bucket=${INFLUXDB_BUCKET}
```

Seems reasonable, right? Expand the INFLUXDB_ORG and INFLUXDB_BUCKET variables from the .env file into the connection string. Except Docker Compose doesn't expand variables within environment variable values. That `${INFLUXDB_ORG}` string was passed literally to k6, which then tried to connect to an organization named literally "${INFLUXDB_ORG}".

The fix required understanding how xk6-influxdb actually wants to be configured. It doesn't want a connection string with inline parameters. It wants individual environment variables: K6_INFLUXDB_ORGANIZATION, K6_INFLUXDB_BUCKET, K6_INFLUXDB_TOKEN. But I couldn't set those directly in docker-compose either because, same problem, variable expansion doesn't work that way.

The solution was to create an entrypoint script. A tiny shell script that runs before k6 starts, reads the INFLUXDB_* variables, constructs the K6_INFLUXDB_* variables correctly, and then executes k6:

```bash
#!/bin/sh
export K6_INFLUXDB_ORGANIZATION="$INFLUXDB_ORG"
export K6_INFLUXDB_BUCKET="$INFLUXDB_BUCKET"
export K6_INFLUXDB_TOKEN="$INFLUXDB_TOKEN"
export K6_INFLUXDB_ADDR="http://influxdb:8086"
export K6_OUT="xk6-influxdb"

exec /usr/bin/k6 "$@"
```

It's a simple script, but it taught me an important lesson: sometimes the solution isn't cleaner architecture or better configuration management. Sometimes it's just understanding the limitations of your tools and working around them pragmatically. Now k6 metrics flowed to InfluxDB reliably, and I could move on to the next problem.

### Artillery's Silent Success

With k6 working, I turned to Artillery. I ran a test. Artillery did its thing, showed me a nice summary in the terminal. Great! Time to check Grafana.

Empty again.

But this time the problem was different. InfluxDB v2 and Artillery simply don't speak to each other natively. Artillery can emit metrics via StatsD, but that's UDP packets with a specific format. InfluxDB v2 expects HTTP requests with line protocol. They're ships passing in the night.

I had already decided to use Telegraf, but actually implementing it revealed subtleties. Telegraf needed to be configured to receive StatsD on one side and write to InfluxDB v2 on the other. That configuration file (telegraf.conf) became crucial:

```toml
[[inputs.statsd]]
  protocol = "udp"
  service_address = ":8125"
  
[[outputs.influxdb_v2]]
  urls = ["${INFLUXDB_URL}"]
  token = "${INFLUXDB_TOKEN}"
  organization = "${INFLUXDB_ORG}"
  bucket = "${INFLUXDB_BUCKET}"
```

But Artillery also needed to know to send to Telegraf. This meant updating every Artillery scenario file to include the StatsD plugin configuration. I could have done this manually in each file, but that violates the "zero-config" principle. Instead, I made the configuration read from environment variables:

```yaml
config:
  plugins:
    statsd:
      host: "{{ $processEnvironment.STATSD_HOST }}"
      port: "{{ $processEnvironment.STATSD_PORT }}"
```

Now docker-compose could inject STATSD_HOST=telegraf and STATSD_PORT=8125, and any Artillery scenario would automatically send metrics. Users writing new scenarios could copy this pattern, or even better, they could ignore it because it would be in the template scenarios they'd copy from.

The architecture worked beautifully once in place. Artillery fired metrics over UDP (fire-and-forget, no blocking). Telegraf received them, aggregated them (calculating percentiles and rates), and wrote batches to InfluxDB every 10 seconds. The whole pipeline was asynchronous and non-blocking. Artillery didn't wait for metrics to be stored before continuing tests.

### The Dashboards That Showed Nothing

With both k6 and Artillery successfully sending metrics to InfluxDB, surely the dashboards would work now?

They showed "No Data."

This was particularly frustrating because I could manually query InfluxDB and see the data sitting there. The data existed. The dashboards were configured with the right datasource. So why the disconnect?

I spent an evening debugging this, and it turned out to be three separate issues layered on top of each other like a troubleshooting matryoshka doll.

First: query language mismatch. I had initially created the dashboards by adapting existing Grafana dashboard templates I'd found online. Many of these templates were written for InfluxDB v1, which uses InfluxQL (a SQL-like language). InfluxDB v2 doesn't support InfluxQL; it only supports Flux. A query like `SELECT mean("value") FROM "http_req_duration"` silently fails in InfluxDB v2. It doesn't throw an error; it just returns no data. The fix was rewriting every query in Flux:

```flux
from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: v.windowPeriod, fn: mean)
```

Second: datasource UID mismatch. When Grafana provisions a datasource without an explicit UID, it assigns a random one. My dashboards were looking for a datasource with UID "influxdb". Grafana couldn't find it, so it showed no data. The fix was adding `uid: influxdb` to the datasource provisioning config. Simple, once you know to look for it.

Third: measurement name assumptions. k6 creates multiple measurements (http_req_duration, http_reqs, vus, iterations, etc.), while Artillery creates one measurement (artillery) with multiple fields (rps, latency, codes). I had queries looking for measurement names that didn't match the actual data structure. This required carefully examining the actual data in InfluxDB and adjusting queries accordingly.

After fixing all three issues and regenerating the dashboards, they finally came alive. Seeing real-time graphs update as tests ran was satisfying in a way that's hard to overstate. This was why I'd built the lab: to have this visibility.

---

## When Services Start But Aren't Ready

There was one more category of problem that took me a while to fully appreciate: the difference between a service starting and a service being ready.

Docker Compose has a `depends_on` directive. You can say "service A depends on service B," and Docker Compose will start B before A. Simple, right? Except it only waits for the container to start, not for the application inside to be ready.

InfluxDB takes several seconds to initialize its database, set up the organization and bucket, and be ready to accept writes. During those seconds, it's running (the container is up), but it's not ready (it won't accept API requests). If k6 tries to write metrics during this window, it fails.

The better approach is health checks:

```yaml
influxdb:
  healthcheck:
    test: ["CMD", "influx", "ping"]
    interval: 5s
    timeout: 5s
    retries: 10

k6:
  depends_on:
    influxdb:
      condition: service_healthy
```

Now Docker Compose waits for InfluxDB to actually respond to health checks before starting dependent services. Problem solved at the orchestration level.

But you could also add user-facing scripts to make this more explicit. A helper script that polls service endpoints until they're ready would give clearer feedback during startup. Something like a `wait-for-stack.sh` script that checks each service's health endpoint and reports status. It's the kind of operational detail that separates a project that works from one that works smoothly, and it would be a good addition for anyone forking this project for production use.

---

## What Success Actually Looks Like

After all the troubleshooting and fixes, the lab finally worked as envisioned. More importantly, it started answering the questions that motivated building it in the first place.

### Understanding Degradation Curves

I ran a gradual ramp-up test against my LLM service: starting with 1 virtual user, increasing by 5 every 30 seconds, up to 100 users. The war room dashboard showed the story clearly.

Up to about 45 concurrent users, the p95 latency stayed under 2 seconds. Users would barely notice variations in response time. Between 45 and 50 users, something changed. The p95 latency jumped to 3.5 seconds, and by 55 users, it hit 5.8 seconds. That's the point where users start complaining, where the experience feels sluggish.

What was fascinating: this wasn't a linear degradation. It wasn't like each additional user added X milliseconds of latency. There was a cliff around 45-50 users where something in the system changed state. Maybe connection pools were saturating. Maybe we were hitting rate limit thresholds from the LLM provider. The dashboard showed the effect clearly; understanding the cause required more investigation, but now I knew where to look.

The actionable outcome: I needed request queuing and graceful degradation implemented before we hit 40 concurrent users in production. Not at 100 users, not "eventually," but at 40. Because that's where the real-world experience started deteriorating.

### Comparing Providers Fairly

I ran identical test scenarios against two different LLM providers I was evaluating. Same load pattern, same request types, same ramp-up schedule. The pro dashboard let me overlay the latency distributions.

Provider A had a median latency of 1.2 seconds. Provider B was 1.8 seconds. On average, Provider A was faster. But the p99 told a different story. Provider A's p99 was 3.4 seconds, while Provider B's was 2.1 seconds. Provider B was more consistent. The slowest 1% of requests on Provider A were significantly slower than on Provider B.

For a chat interface where users expect immediate responses, those p99 numbers matter more than the median. A user who occasionally waits 3+ seconds will have a worse experience than a user who consistently waits ~2 seconds. I chose Provider B for interactive features and Provider A for batch processing where consistency mattered less than average throughput.

This wasn't information I could get from vendor documentation or synthetic benchmarks. It required running realistic load against my specific use case and observing the distribution of outcomes.

### Projecting Real Costs

The cost question required a different kind of test: simulating realistic user behavior patterns. Not hammering the API as fast as possible, but modeling how actual users behave. A user makes a request, reads the response (think time), maybe makes a follow-up request, then leaves. Sessions have variable lengths. Some users make one request and disconnect; others have extended conversations.

I built a scenario that modeled this: random think time between 5-15 seconds, session durations following a distribution (short sessions common, long sessions rare), variable request sizes. Then I ran it at scale: simulating 1000 concurrent users with this behavior pattern for an hour.

The metrics told me exactly what my token consumption rate was under realistic conditions. Not theoretical "if every request is exactly N tokens," but accounting for variation, accounting for retries, accounting for partial responses from streaming. With those numbers, I could project costs accurately.

The finding: at 1000 monthly active users with typical usage patterns (about 5 requests per session, average 1500 tokens per request), my costs would be approximately $847/month. That's real information I could use for pricing decisions, margin calculations, and budget planning. And critically, I could see how costs scaled non-linearly with different usage patterns.

### Finding the Real Bottleneck

The capacity planning test ran for four hours: sustained load at increasing levels, monitoring both application metrics and infrastructure metrics. I wanted to find what would break first.

Surprisingly, it wasn't my application servers. CPU and memory were fine. It wasn't my database; query performance held steady. The bottleneck was hitting API rate limits from the LLM provider. At around 120 concurrent users sustaining typical request rates, we started seeing 429 (rate limit) responses.

This was incredibly valuable information. It meant I didn't need to scale my infrastructure; I needed to negotiate higher rate limits with providers. Or implement smarter request batching. Or add request queuing to smooth out bursts. The lab showed me exactly where to focus optimization efforts instead of guessing or over-provisioning resources that weren't the constraint.

---

## Reflections on Building Developer Tools

Building this lab taught me things about tool design that extend beyond load testing. If I were giving advice to someone building a similar developer tool, here's what I'd emphasize.

### Start With Your Real Problem, Not the General One

I didn't set out to build "a load testing platform." I set out to answer specific questions about my LLM service. That specificity drove every design decision. The questions I needed answered determined what metrics to collect, what dashboards to build, what test scenarios to include.

If I'd tried to build something generic, I'd either have built something overly complex (trying to handle every possible use case) or uselessly simple (handling nothing particularly well). Starting specific let me build something immediately useful, and the generality emerged naturally from making it reusable.

### Optimize for the First-Run Experience

Documentation can't save a bad first-run experience. If it takes someone half an hour of reading and configuring before they can run their first test, you've lost them. They'll go back to whatever they were doing before, even if it's inferior, because the activation energy was too high.

`git clone && docker-compose up && run first test` needed to work perfectly. Everything else could have rough edges, but that path needed to be smooth. It's why I pre-compiled k6, why I auto-provisioned datasources, why I included working example scenarios. Reduce friction for the first 5 minutes, and users will forgive complexity later.

### Build Troubleshooting Into the Tool

The diagnostic scripts aren't supplementary; they're core features. When something goes wrong (and something always goes wrong), the tool should help you understand what and why. Health check endpoints, status verification scripts, example queries for manual validation: these aren't documentation to write later, they're features to build first.

The DIAGNOSIS_AND_SOLUTION.md document exists because I hit every problem in there and had to debug it. By documenting those problems and their solutions immediately, I turned my debugging sessions into permanent troubleshooting knowledge for users. That document has probably saved more time than any other piece of documentation.

### Layer Complexity, Don't Hide It

There's a temptation to hide complexity from users. "They don't need to know how this works; they just need to use it." But that philosophy breaks down when something goes wrong or when someone needs to customize behavior.

Instead, I layered it. The simple path is truly simple: `docker-compose up` and you're running. But if you want to understand what's happening, every configuration file is visible. If you want to customize, you can edit docker-compose.yml and see exactly what will change. If you want to debug, you can see the actual data in InfluxDB and the actual queries Grafana is running.

The complexity is there, but it's optional. You can use the tool without understanding it, but you can also dig as deep as you need when you need to.

### Documentation is Code, Code is Documentation

The docker-compose.yml file is documentation of the architecture. The .env file documents the available configuration. The example scenarios document how to write tests. The dashboard JSON files document what metrics are available and how to query them.

These aren't separate artifacts that need to be kept in sync with documentation. They *are* the documentation. The supplementary docs (README, troubleshooting guides, this blog post) exist to provide context and narrative, but the authoritative source is always the code itself.

This is why I spent time making the code readable, adding comments, using clear naming conventions. Because the code is what people will reference when documentation is unclear or outdated.

---

## The Lab Today and What's Next

The load testing lab is fully functional and answers the questions I set out to answer. It's open source, documented, and has grown beyond just being a tool I built for myself. People are using it, finding issues, suggesting improvements. That feels good.

But like any software project, there are things I'd do differently if I were starting over, and things I still want to add.

### What Could Be Better

The health check automation works, but it's not as robust as I'd like. Right now there are helper scripts that poll endpoints and wait for services to be ready. It works, but it requires users to remember to run those scripts. I'd prefer if docker-compose itself handled more of this automatically, with better retry logic and clearer error messages when services fail to start.

Metric retention is another area. The current setup keeps all data forever, which is fine for a lab environment but wouldn't scale well if you were running tests continuously. InfluxDB supports downsampling and retention policies, but I haven't configured sensible defaults. Someone running this in a CI/CD pipeline would want automatic cleanup of old data.

Speaking of CI/CD, the lab doesn't include integration examples. You can absolutely run it in GitHub Actions or GitLab CI, but you'd need to figure out the Docker-in-Docker setup yourself. Template workflow files would make that path much smoother.

And remember that cost tracking dashboard I mentioned needing? I still haven't built it. I can calculate costs manually from the metrics, but there should be a dashboard that does token-to-dollars conversion automatically. It's on the list.

### What I Got Right

Starting with Docker Compose instead of Kubernetes was correct. It made the barrier to entry low while still giving a production-like environment. Kubernetes would have been impressive but unusable for most people who just wanted to test their APIs on their laptops.

Pre-compiling k6 with the necessary extensions was one of the best time investments. Users don't need to know what xk6 is, don't need Go installed, don't need to understand module compilation. They just use k6, and it works with InfluxDB v2. That decision alone probably saved hundreds of hours of support questions.

The six dashboards seemed like overkill at first, but it was the right call. Different situations need different views, and having purpose-built dashboards for each use case is better than one generic dashboard trying to do everything. The war room dashboard is what you want when actively monitoring a test. The pro dashboard is what you want when analyzing results afterward. They're different tools for different jobs.

And maybe most importantly: writing comprehensive troubleshooting documentation from day one. The [docs/DIAGNOSIS_AND_SOLUTION.md](../../docs/DIAGNOSIS_AND_SOLUTION.md) document captures every problem I encountered and how I fixed it. That's not documentation I wrote after the fact; it's documentation I wrote *as* I fixed each problem. It's probably the most valuable document in the repository because it turns my pain into someone else's quick solution.

---

## If You Want to Try It

The complete lab is open source on GitHub. Everything I've described in this article, all the solutions to all the problems, all the dashboards and scenarios and diagnostic scripts, it's all there.

You can clone the repository and have a working load testing environment in about five minutes:

```bash
git clone https://github.com/destbreso/load-testing-lab.git
cd load-testing-lab
docker-compose up -d

# Wait for services to be ready (about 10 seconds)

# Run your first k6 test
docker-compose run --rm k6 run /k6/scenarios/toy-fast.js

# Or an Artillery test
docker-compose run --rm artillery run /artillery/scenarios/toy-fast.yml

# Open Grafana to see the results
open http://localhost:3081
```

The credentials are in the README (admin/admin123 for Grafana), and there's a complete guide to all six dashboards in [grafana/DASHBOARDS.md](../../grafana/DASHBOARDS.md).

If you want to understand the concepts and patterns in more depth, there's a [complete tutorial series](../README.md) in the repository that walks through everything from basic load testing concepts to advanced scenarios, CI/CD integration, and chaos engineering. The same series is also published at [destbreso.com](https://destbreso.com) if you prefer reading in a browser with better formatting.

For technical deep-dives into specific components:
- [docs/DIAGNOSIS_AND_SOLUTION.md](../../docs/DIAGNOSIS_AND_SOLUTION.md) for troubleshooting k6, Artillery, InfluxDB, and Grafana integration
- [docs/ARTILLERY_IMPLEMENTATION_SUMMARY.md](../../docs/ARTILLERY_IMPLEMENTATION_SUMMARY.md) for details on the Telegraf bridge architecture
- [docs/EXTERNAL_PROJECTS.md](../../docs/EXTERNAL_PROJECTS.md) for using the lab with your own projects (scenarios and dashboards from any folder)
- [END_TO_END_TESTING_GUIDE.md](../../END_TO_END_TESTING_GUIDE.md) for validation procedures and verification steps
- [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md) for current status of all components

---

## Final Thoughts

Building this lab reinforced something I've learned over years of development: the best tools solve specific problems, not general ones.

I didn't set out to build "the ultimate load testing platform." I set out to answer specific questions about my LLM service under load. The specificity of those questions drove every decision. What metrics to collect, what dashboards to build, what scenarios to include, what complexity to hide and what to expose.

The generality came later, from making it reusable. But it started specific, solving a real problem I actually had.

### The Multi-Project Vision Realized

Remember the multi-project problem I mentioned earlier? The frustration of maintaining separate load testing stacks for each project?

That became a core feature of the lab. Today, I can:

```bash
# Test my payment API
cd ~/projects/payment-api
ltlab k6 -s ./tests/load/checkout-stress.js
ltlab dashboard link ./tests/load/dashboards

# Switch to fleet management service
cd ~/projects/fleet-api
ltlab k6 -p ./tests/load -s main.js
ltlab dashboard link ./tests/dashboards

# All using the SAME lab infrastructure
```

Each project keeps its test scenarios and custom dashboards in its own repository. The lab remains a shared, well-maintained tool. When I upgrade Grafana or fix a dashboard issue, every project benefits. No more configuration drift. No more per-project maintenance overhead.

The CLI auto-detects local files and mounts them dynamically. You don't copy files into the lab—you point the lab at your project. This inversion was key: the lab adapts to your projects, not the other way around.

**Why this matters:**

- **Cleaner organization**: Tests live with the code they test. No hunting across repos.
- **Natural ownership**: Each team owns their tests. No coordination bottlenecks.
- **Simpler onboarding**: "Here's the lab, here are our tests" instead of "here's our fork of the lab with our customizations."
- **Robust upgrades**: Improve the lab → everyone benefits. Improve your tests → your project benefits. No entanglement.

It's a pattern I try to apply repeatedly: separate the generic infrastructure from the specific configuration. Keep each in its natural home. Let them evolve independently.

If you're building developer tools, or thinking about building one, my advice is this: start with the problem you actually have, not the problem you think other people might have. Build something that works for your specific case first. Make it work so well for that case that you'd rather use it than anything else. Then, and only then, think about how to make it general.

Your specific problem is what gives you insight that generalized thinking can't. It's what helps you understand which complexity matters and which doesn't. It's what tells you where the rough edges are, what the common failure modes are, what questions people actually need answered.

This lab exists because I had questions I couldn't answer with existing tools. Maybe you have questions too. Maybe this lab answers them. Or maybe you'll build something different that answers your specific questions better. Either way, start with the real problem. That's where good tools come from.

---

## Let's Keep the Conversation Going

If you found this article useful, or if you're building similar tools, or if you have questions about load testing, I'd love to hear from you. 

You can find the repository at [GitHub/load-testing-lab](https://github.com/destbreso/load-testing-lab). Issues and pull requests are welcome. There's also a Discussions section where you can ask questions or share how you're using the lab.

I'm on Twitter [@destbreso](https://twitter.com/destbreso) and you can reach me through the blog at [destbreso.com](https://destbreso.com). I try to respond to everyone, though it sometimes takes a few days.

If you build something interesting with the lab, or if you write about your own tool-building journey, let me know. I'd love to see what you create.

Thanks for reading. Now go test something.

---

**Related Resources:**

📚 **In This Repository:**
- [Complete Tutorial Series](../README.md) - 13 articles from basics to advanced topics  
- [Troubleshooting Guide](../../docs/DIAGNOSIS_AND_SOLUTION.md) - Solutions to common problems  
- [Dashboard Documentation](../../grafana/DASHBOARDS.md) - Guide to all 6 dashboards  
- [Verified Examples](../VERIFIED_EXAMPLES.md) - 30+ copy-paste ready scenarios

🌐 **Online:**
- [Course at destbreso.com](https://destbreso.com) - Full tutorial series with better formatting  
- [GitHub Repository](https://github.com/destbreso/load-testing-lab) - Source code and issues  

📖 **Technical References:**
- [xk6-influxdb Documentation](https://github.com/grafana/xk6-output-influxdb)  
- [Artillery Documentation](https://www.artillery.io/docs)  
- [InfluxDB v2 Guide](https://docs.influxdata.com/influxdb/v2.0/)  
- [Grafana Flux Queries](https://grafana.com/docs/grafana/latest/datasources/influxdb/)

---

*Written by David Estevez*  
*Published: January 24, 2026*  
*Last updated: January 24, 2026*

*This article is part of the load-testing-lab project, released under the MIT License. Feel free to share, adapt, and build upon it.*
