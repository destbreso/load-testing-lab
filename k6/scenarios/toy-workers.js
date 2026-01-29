import http from "k6/http";
import { sleep } from "k6";

export const options = {
  vus: 20,
  duration: "40s",
};

export default function () {
  const submit = http.post(
    `${__ENV.TARGET_API_URL}/jobs`,
    JSON.stringify({ mode: "mixed" }),
    { headers: { "Content-Type": "application/json" } },
  );

  const job = JSON.parse(submit.body);
  if (!job.jobId) return;

  let attempts = 0;
  while (attempts < 6) {
    const status = http.get(`${__ENV.TARGET_API_URL}/jobs/${job.jobId}`);
    const body = JSON.parse(status.body);

    if (body.status === "done" || body.status === "failed") break;

    sleep(0.6);
    attempts++;
  }
}
