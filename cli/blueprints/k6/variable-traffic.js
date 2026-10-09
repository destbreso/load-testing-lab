import http from "k6/http";

// Open model: requests arrive at a rate that rises and falls over ten
// minutes, whether or not the API keeps up. k6 starts each iteration on
// schedule; when responses slow down it needs more virtual users, up to
// maxVUs, and counts any iteration it cannot start in dropped_iterations.
export const options = {
  scenarios: {
    variable_arrivals: {
      executor: "ramping-arrival-rate",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { duration: "2m", target: 20 }, // traffic builds up
        { duration: "3m", target: 20 }, // steady
        { duration: "1m", target: 40 }, // a peak
        { duration: "2m", target: 40 },
        { duration: "2m", target: 5 }, // falls off
      ],
    },
  },
};

export default function () {
  http.get(`${__ENV.TARGET_API_URL}/endpoint`);
}
