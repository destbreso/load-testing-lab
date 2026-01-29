import http from "k6/http";
import { sleep } from "k6";

export let options = {
  vus: 30,
  duration: "5m",
};

export default function () {
  http.get(`${__ENV.TARGET_API_URL}/users`);
  sleep(2);

  http.post(`${__ENV.TARGET_API_URL}/login`, {
    username: "test",
    password: "1234",
  });
  sleep(3);
}
