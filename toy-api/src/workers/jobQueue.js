import { jobStore } from "./jobStore.js";

const queue = [];
let isProcessing = false;

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
