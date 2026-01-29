import http from "k6/http";
import { sleep } from "k6";

export let options = {
  scenarios: {
    random_arrival: {
      executor: "constant-arrival-rate",
      rate: 20,
      timeUnit: "1s",
      duration: "10m",
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
};

export default function () {
  http.get(`${__ENV.TARGET_API_URL}/endpoint`);
  sleep(Math.random() * 2);
}
