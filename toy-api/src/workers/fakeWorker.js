import { enqueueJob } from "./jobQueue.js";
import { jobStore } from "./jobStore.js";

console.log("Fake Worker started");

setInterval(() => {
  const stats = {
    total: jobStore.size,
    queued: 0,
    processing: 0,
    done: 0,
    failed: 0,
  };

  for (const job of jobStore.values()) {
    stats[job.status]++;
  }

  console.log("[Worker Stats]", stats);
}, 5000);

export function submitJob({ mode = "mixed" } = {}) {
  const job = {
    id: Math.random().toString(36).slice(2),
    status: "queued",
    mode,
    createdAt: Date.now(),
  };

  enqueueJob(job);
  return job;
}
