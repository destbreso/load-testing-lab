import http from "k6/http";
import { sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 20 },
    { duration: "30s", target: 60 },
    { duration: "10s", target: 0 },
  ],
};

export default function () {
  const r = Math.random();

  if (r < 0.4) {
    http.get(`${__ENV.TARGET_API_URL}/fast`);
  } else if (r < 0.6) {
    http.get(`${__ENV.TARGET_API_URL}/slow`);
  } else if (r < 0.75) {
    http.get(`${__ENV.TARGET_API_URL}/users`);
  } else if (r < 0.9) {
    http.get(`${__ENV.TARGET_API_URL}/cpu`);
  } else {
    http.get(`${__ENV.TARGET_API_URL}/error`);
  }

  sleep(Math.random() * 1.2);
}
