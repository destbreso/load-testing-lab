import { jobStore } from "./jobStore.js";

const queue = [];
let isProcessing = false;

// A finished job stays readable through GET /jobs/:id for this long, then
// leaves the store, so the API's memory stays bounded however long it runs
const JOB_TTL_MS = Number(process.env.JOB_TTL_MS) || 10 * 60 * 1000;

export function enqueueJob(job) {
  queue.push(job);
  jobStore.set(job.id, job);
  processQueue();
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const job = queue.shift();
    await runJob(job);
  }

  isProcessing = false;
}

async function runJob(job) {
  job.status = "processing";
  job.startedAt = Date.now();

  try {
    await simulateWork(job);
    job.status = "done";
    job.result = { ok: true };
  } catch (err) {
    job.status = "failed";
    job.result = { error: err.message };
  } finally {
    job.finishedAt = Date.now();
    setTimeout(() => jobStore.delete(job.id), JOB_TTL_MS).unref();
  }
}

async function simulateWork(job) {
  const mode = job.mode || "mixed";

  if (mode === "cpu") {
    let total = 0;
    for (let i = 0; i < 8_000_000; i++) {
      total += Math.sqrt(i);
    }
  }

  if (mode === "io") {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 2500));
  }

  if (mode === "mixed") {
    let total = 0;
    for (let i = 0; i < 3_000_000; i++) {
      total += Math.sqrt(i);
    }
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 2000));
  }

  if (Math.random() < 0.1) {
    throw new Error("Random worker failure");
  }
}
