export const jobStore = new Map();

/**
 * Job shape:
 * {
 *   id,
 *   status: "queued" | "processing" | "done" | "failed",
 *   createdAt,
 *   startedAt?,
 *   finishedAt?,
 *   result?
 * }
 */
