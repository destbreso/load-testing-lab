import { Router } from "express";
import { submitJob } from "../workers/fakeWorker.js";
import { jobStore } from "../workers/jobStore.js";

const router = Router();

// Submit job
router.post("/", (req, res) => {
  const mode = req.body?.mode || "mixed";
  const job = submitJob({ mode });

  res.status(202).json({
    accepted: true,
    jobId: job.id,
    mode: job.mode,
    status: job.status,
  });
});

// Get job status
router.get("/:id", (req, res) => {
  const job = jobStore.get(req.params.id);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(job);
});

export default router;
