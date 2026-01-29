import http from "k6/http";
import { sleep } from "k6";

export const options = {
  vus: Number(__ENV.CONCURRENCY) || 50,
  duration: __ENV.DURATION || "30s",
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  http.get(`${__ENV.TARGET_API_URL}/fast`);
  sleep(0.1);
}
