// One run of the lab, request by request: k6 runs chaos-basic.js against the
// API that TARGET_API_URL names (the toy API, or your own), and every answer's
// sample goes to InfluxDB and on to Grafana, to the lab's dashboards and to the
// ones you linked.
//
// A dissect model (github.com/destbreso/dissect): it runs as a seeded
// discrete-event simulation, and the figure only moves what the simulation
// moves. Build the page with dissect's build script:
//   node <dissect>/skills/dissect/scripts/build.mjs docs/figures/run.model.mjs --out docs/figures/run.html --audit --check
//
// Every number comes from this repository, or is marked as measured or assumed:
// - k6/scenarios/chaos-basic.js: stages 30 s up to 20 virtual users, 1 min at
//   20, 20 s down to none; one GET per iteration, weighted fast 3, slow 2,
//   error 2, cpu 1; a 5 s request timeout; the check passes on status 200 under
//   3 s; sleep 0.5 + random * 1.5 s; thresholds p(95) < 3000 ms and errors < 50%.
// - toy-api/src: one Node process; /slow waits 500 + random * 2000 ms on a
//   timer, /error answers 500 when Math.random() < 0.3, /cpu runs 10 million
//   Math.sqrt on the event loop.
// - Your API: TARGET_API_URL in .env (http://host.docker.internal:<port> for an
//   API on your machine), or -e TARGET_API_URL=... for one run; scenarios read
//   it as __ENV.TARGET_API_URL (the built-in ones and the blueprints in
//   cli/blueprints/k6). Against it the figure keeps chaos-basic.js's stages,
//   pauses, check and thresholds, with one kind of request, so the two targets
//   compare; its numbers are yours to set, as dials.
// - k6/entrypoint.sh: the InfluxDB output is on only when the bucket, the org
//   and the token are set.
// - grafana/: every dashboard refreshes every 5 s; ltlab dashboard link <dir>
//   copies your dashboards' JSON into grafana/dashboards/custom/, which Grafana
//   rescans every 10 s and shows as a folder named custom, beside the lab's six.
// Measured on the author's machine (Apple Silicon, Node 22, the toy API itself,
// saturated with keep-alive connections): /fast and /error hold the event loop
// about 0.08 ms, /cpu 9 to 16 ms. Assumed: k6's InfluxDB output pushes once a
// second (its default; the repository does not set it), the bridge network
// takes well under a millisecond, and a write to InfluxDB a few milliseconds.

const REQUESTS = ["fast", "slow", "error", "cpu", "request"];
const users = (n) => [
  [30, n],
  [60, n],
  [20, 0],
];

export default {
  id: "ltlab-run",
  title: "One run of the lab, request by request",
  about: "When you run ltlab k6 -s chaos-basic.js, Compose starts a k6 container, and k6 ramps virtual users against the API that TARGET_API_URL names: the toy API by default, or your own API, with your own scenario. Every answer's sample goes to InfluxDB and on to Grafana, to the lab's dashboards and to the ones you linked. Each dot is one request; dashed rails carry samples.",
  item: "request",
  items: "requests",
  unit: "s",
  seed: 1,
  horizon: 110,
  lanes: [
    { id: "k6", label: "k6" },
    { id: "target", label: "Target" },
    { id: "influx", label: "InfluxDB" },
    { id: "grafana", label: "Grafana" },
  ],
  parts: [
    {
      id: "vus",
      kind: "start",
      lane: "k6",
      at: [0, 0],
      label: "virtual users",
      vus: users(20),
      think: "uni 0.5 2",
      classes: { fast: 3, slow: 2, error: 2, cpu: 1 },
      about: "chaos-basic.js's virtual users: each one picks a route (fast, slow, error or cpu, weighted 3, 2, 2 and 1) and sends one GET at a time. Your own scenario runs the same way from your project's folder, with its own stages and requests: ltlab k6 -s ./load-tests/my-test.js, or ltlab k6 -p ./my-tests -s main.js to mount a whole folder, helpers and data with it.",
      dials: [{ label: "Virtual users", restart: true, options: [{ label: "20" }, { label: "50", set: { vus: users(50) } }, { label: "100", set: { vus: users(100) } }] }],
    },
    {
      id: "url",
      kind: "choice",
      lane: "target",
      at: [1, 0],
      label: "TARGET_API_URL",
      about: "Where the requests go: the toy API by default (TARGET_API_URL=http://toy-api:5000 in .env, on the lab's network), or your API: set TARGET_API_URL in .env (http://host.docker.internal:<port> for one on your machine, or its URL), or pass -e TARGET_API_URL=... for one run. Scenarios read it as __ENV.TARGET_API_URL, as the built-in ones and the blueprints do.",
      dials: [
        {
          label: "Target",
          restart: true,
          options: [
            { label: "toy API" },
            { label: "your API", set: { take: "to-yours" }, changes: [{ part: "vus", set: { classes: { request: 1 } } }] },
          ],
        },
      ],
    },
    {
      id: "toy",
      kind: "station",
      lane: "target",
      at: [2, 0],
      label: "Toy API",
      glyph: "server",
      about: "The lab's built-in target. One Node.js process, so one event loop: every request goes through it. Open it to watch the loop.",
      inside: {
        lanes: [
          { id: "loop", label: "Event loop" },
          { id: "timers", label: "Timers" },
        ],
        parts: [
          { id: "in", kind: "start", lane: "loop", at: [0, 0], label: "request" },
          {
            id: "loop",
            kind: "station",
            lane: "loop",
            at: [1, 0],
            label: "Event loop",
            glyph: "server",
            servers: 1,
            spec: "10 ms on /cpu",
            work: { cpu: "logn 0.01 0.016", else: "logn 0.00008 0.00012" },
            fail: { error: 0.3 },
            failLabel: "answered 500",
            patience: 5,
            about: "One request at a time. /fast and /error take a few hundredths of a millisecond; /cpu holds the loop for its 10 million square roots, and every other request waits behind it. A request that waits 5 s is dropped by k6's timeout.",
          },
          { id: "next", kind: "choice", lane: "loop", at: [2, 0], label: "answered?" },
          { id: "wait", kind: "timer", lane: "timers", at: [2, 0], label: "/slow's timer", wait: "uni 0.5 2.5", about: "/slow waits 0.5 to 2.5 s on a timer, without holding the event loop; when the timer fires, the loop sends the answer." },
          { id: "ok", kind: "end", lane: "loop", at: [3, 0], label: "200" },
          { id: "err", kind: "end", lane: "loop", at: [3, 1], label: "500", outcome: "fail" },
          { id: "lost", kind: "end", lane: "timers", at: [3, 0], label: "timed out", outcome: "timeout" },
        ],
        routes: [
          { from: "in", to: "loop" },
          { from: "loop", to: "next" },
          { id: "to-timer", from: "next", to: "wait", when: "class:slow", max: 1, label: "slow" },
          { from: "wait", to: "loop", label: "" },
          { from: "next", to: "err", when: "fail", label: "500" },
          { from: "next", to: "lost", when: "timeout", label: "5 s", seldom: true },
          { from: "next", to: "ok", when: "else", label: "" },
        ],
      },
    },
    {
      id: "yours",
      kind: "station",
      lane: "target",
      at: [2, 1],
      label: "Your API",
      glyph: "service",
      servers: 16,
      work: "logn 0.15 0.6",
      fail: 0.01,
      failLabel: "errors",
      patience: 5,
      about: "Any API the k6 container can reach. Its numbers are yours to set: how long it answers in, and how many requests it takes at once (its workers, its pool). The figure sends it one kind of request with chaos-basic.js's stages, check and thresholds, so the two targets compare; your own scenario sets its own.",
      dials: [
        { label: "Answers in", value: 1, options: [{ label: "50 ms", set: { work: "logn 0.05 0.2" } }, { label: "150 ms" }, { label: "600 ms", set: { work: "logn 0.6 2.5" } }] },
        { label: "At once", value: 1, options: [{ label: "4", set: { servers: 4 } }, { label: "16" }, { label: "64", set: { servers: 64 } }] },
      ],
    },
    { id: "checks", kind: "choice", lane: "k6", at: [3, 0], label: "check passes?", about: "k6's check: status 200, in under 3 s. A request that fails it counts in the errors rate, whose threshold is 50%; the p95 of all answers must stay under 3 s." },
    { id: "passed", kind: "end", lane: "k6", at: [4, 0], label: "passed" },
    { id: "failed", kind: "end", lane: "k6", at: [4, 1], label: "failed", outcome: "fail" },
    {
      id: "output",
      kind: "choice",
      lane: "influx",
      at: [3, 0],
      label: "output on?",
      switch: { label: "InfluxDB output" },
      about: "The runner's entrypoint turns k6's InfluxDB output on only when the bucket, the org and the token are set. Without them it prints a warning and the run goes on, with nothing sent: the dashboards stay empty.",
    },
    { id: "unsent", kind: "end", lane: "influx", at: [2, 0], label: "not sent" },
    { id: "push", kind: "timer", lane: "influx", at: [4, 0], label: "next push", wait: "uni 0 1", about: "k6 keeps its samples and pushes them to InfluxDB once a second." },
    { id: "write", kind: "station", lane: "influx", at: [5, 0], label: "InfluxDB", glyph: "db", servers: "inf", work: "uni 0.002 0.01", about: "The bucket loadtests: one point per sample, kept forever (no retention is set)." },
    {
      id: "grafana",
      kind: "station",
      lane: "grafana",
      at: [5, 0],
      label: "Grafana",
      glyph: "browser",
      servers: "inf",
      work: "uni 0 5",
      spec: "refreshes every 5 s",
      about: "Every dashboard refreshes every 5 s, and Grafana's server runs its panels' Flux queries against InfluxDB: a sample shows on a panel at the next refresh after it was written, on every dashboard that reads it.",
    },
    { id: "lab", kind: "end", lane: "grafana", at: [6, 0], label: "lab dashboards" },
    {
      id: "linked",
      kind: "choice",
      lane: "grafana",
      at: [5, 1],
      label: "yours linked?",
      switch: { label: "Your dashboards" },
      about: "ltlab dashboard link <dir> copies your dashboards' JSON into grafana/dashboards/custom/, and Grafana, which rescans it every 10 s, shows them in a folder named custom beside the lab's six, reading the same samples; ltlab dashboard unlink takes them out.",
    },
    { id: "mine", kind: "end", lane: "grafana", at: [6, 1], label: "your dashboards" },
    { id: "unlinked", kind: "end", lane: "grafana", at: [4, 1], label: "not linked" },
  ],
  routes: [
    { from: "vus", to: "url" },
    { id: "to-toy", from: "url", to: "toy", p: 1, label: "toy-api", latency: "uni 0.0002 0.0008" },
    { id: "to-yours", from: "url", to: "yours", p: 0, label: "your URL", latency: "uni 0.0005 0.002", seldom: true },
    { from: "toy", to: "checks", latency: "uni 0.0002 0.0008" },
    { from: "yours", to: "checks", latency: "uni 0.0005 0.002", seldom: true },
    // only an answer that slows past 3 s takes it: /slow waiting longer, a slow API, a full queue
    { id: "slow-check", from: "checks", to: "failed", when: "late:3", label: "3 s or more", seldom: true },
    { from: "checks", to: "passed", when: "ok", label: "200" },
    { from: "checks", to: "failed", when: "else", label: "not 200" },
    { from: "checks", to: "output", emit: "sample" },
    { id: "sent", from: "output", to: "push", p: 1, label: "" },
    { id: "dropped", from: "output", to: "unsent", p: 0, bypass: true, label: "", seldom: true },
    { from: "push", to: "write" },
    { from: "write", to: "grafana" },
    { from: "grafana", to: "lab" },
    { from: "grafana", to: "linked", emit: "sample" },
    { id: "shown", from: "linked", to: "mine", p: 1, label: "" },
    { id: "unshown", from: "linked", to: "unlinked", p: 0, bypass: true, label: "", seldom: true },
  ],
  claims: [
    { metric: "kind.slow.lead.p95", max: 3, say: "even /slow's p95 stays under the 3 s threshold" },
    { metric: "kind.error.end.failed", near: 0.3, tol: 0.25, say: "about three /error requests in ten fail their check" },
    { metric: "toy/loop.utilization", max: 0.05, say: "the event loop is idle almost all of the run" },
  ],
};

// what the caption measures, from a run's log
function requestsOf(log) {
  const born = new Map(log.filter((r) => r.k === "born").map((r) => [r.tok, r]));
  const leads = [];
  let failed = 0;
  for (const r of log) {
    if (r.k !== "done" || !REQUESTS.includes(born.get(r.tok)?.cls)) continue;
    leads.push(r.t - born.get(r.tok).t);
    if (r.outcome !== "ok") failed += 1;
  }
  leads.sort((a, b) => a - b);
  const steady = log.filter((r) => r.k === "born" && r.at === "vus" && r.t > 35 && r.t < 85).length / 50;
  return { n: leads.length, p95: leads[Math.floor(leads.length * 0.95)], errors: failed / leads.length, steady };
}
/** Of the samples written, the median time from the answer to a panel of the lab's dashboards. */
function lagOf(log) {
  const born = new Map(log.filter((r) => r.k === "born" && r.cls === "sample").map((r) => [r.tok, r.t]));
  const lags = log.filter((r) => r.k === "done" && r.at === "lab").map((r) => r.t - born.get(r.tok)).sort((a, b) => a - b);
  return lags[Math.floor(lags.length / 2)];
}
const pc = (v) => `${Math.round(v * 100)}%`;
const s1 = (v) => v.toFixed(1);
const many = (v) => Math.round(v).toLocaleString("en-US");
const verdict = (r) => (r.p95 < 3 && r.errors < 0.5 ? "k6 exits 0" : "k6 exits 99");

export const figure = {
  fig: "Fig 1",
  pace: 1,
  speed: 1,
  levelPace: { toy: 0.25 },
  watch: { kinds: REQUESTS, label: "checks passed", quantile: 0.95, window: 15 },
  embedHeight: true,
  caption: ({ run, sim, variant }) => {
    const base = requestsOf(sim.log);
    const slow = requestsOf(variant(null, { changes: [{ t: 0, part: "toy/wait", set: { wait: "uni 1 5" } }] }).log);
    // your API as written (16 at once, 150 ms), then the same API with 4 at once under 100 users
    const yours = { changes: [{ t: 0, part: "url", set: { take: "to-yours" } }, { t: 0, part: "vus", set: { classes: { request: 1 } } }] };
    const mine = requestsOf(variant(null, yours).log);
    const tight = requestsOf(variant(null, { changes: [...yours.changes, { t: 0, part: "vus", set: { vus: users(100) } }, { t: 0, part: "yours", set: { servers: 4 } }] }).log);
    return (
      `chaos-basic.js ramps up to 20 virtual users against the toy API: ${many(base.n)} requests, ${s1(base.steady)} a second in the steady minute. ` +
      `95% of them are answered within ${s1(base.p95)} s, under the 3 s threshold, and ${pc(base.errors)} fail their check, almost all of them /error's 500s: ${verdict(base)}. ` +
      `That p95 is /slow's timer, not the load: the event loop is busy ${pc(run.stations["toy/loop"].utilization)} of the run. Make /slow wait twice as long and the p95 is ${s1(slow.p95)} s, so ${verdict(slow)}, and the users send ${many(slow.n)} requests instead of ${many(base.n)}, since each one waits for its answer. ` +
      `Point TARGET_API_URL at your own API and a run of the same shape measures it: answering in 150 ms with 16 requests at once, the p95 is ${s1(mine.p95)} s; give it 100 users and only 4 at a time and the queue takes over: p95 ${s1(tight.p95)} s and ${pc(tight.errors)} of checks failed, so ${verdict(tight)}. ` +
      `Every answer's sample reaches the lab's dashboards about ${s1(lagOf(sim.log))} s later, and the dashboards you linked at the same time. Click the target or the virtual users to set them, and your API to give it your numbers.`
    );
  },
};
