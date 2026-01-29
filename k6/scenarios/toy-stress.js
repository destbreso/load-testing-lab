import http from "k6/http";
import { sleep } from "k6";

export const options = {
  stages: [
    { duration: "15s", target: 50 },
    { duration: "20s", target: 150 },
    { duration: "30s", target: 300 },
    { duration: "10s", target: 0 },
  ],
};

export default function () {
  const r = Math.random();

  if (r < 0.3) {
    http.get(`${__ENV.TARGET_API_URL}/fast`);
  } else if (r < 0.6) {
    http.get(`${__ENV.TARGET_API_URL}/slow`);
  } else {
    http.get(`${__ENV.TARGET_API_URL}/cpu`);
  }

  sleep(Math.random() * 0.3);
}
