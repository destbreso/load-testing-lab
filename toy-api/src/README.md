
# Toy API

A lightweight API designed to provide **realistic endpoints for load testing**.

## Available Endpoints

| Endpoint  | Behavior                                                           |
|-----------|--------------------------------------------------------------------|
| `/fast`   | Instant response                                                   |
| `/slow`   | Variable latency (500-2500 ms)                                     |
| `/error`  | Random failures (30% of requests answer 500)                       |
| `/cpu`    | CPU-heavy workload (a synchronous loop that blocks the event loop) |
| `/io`     | Simulated I/O (300-1500 ms)                                        |
| `/users`  | JSON dataset (50 users)                                            |
| `/jobs`   | Async job simulation                                               |
| `/health` | Health check (also used by the container's health check)           |

The API listens on port 5000: `http://toy-api:5000` from the lab's containers, `http://localhost:5000` from your machine (`TOY_API_PORT` in the lab's `.env` changes the host port).

## Jobs

- `POST /jobs` with a JSON body `{"mode": "cpu"}`, `"io"` or `"mixed"` (the default) answers `202` with the job's `jobId`.
- A single worker runs the jobs one at a time, in the order they arrive. About 10% of them fail at random.
- When the queue is idle, the CPU loop of a `cpu` or `mixed` job runs inside the `POST` request, before the `202` answer.
- `GET /jobs/:id` returns the job and its status (`queued`, `processing`, `done` or `failed`), or `404` for an unknown id.
- A finished job stays readable for 10 minutes after it finishes, then leaves the in-memory store, so the API's memory stays bounded however long a test runs: a soak test against the toy API shows flat memory, and `GET /jobs/:id` answers `404` for a job that finished more than 10 minutes earlier. The `JOB_TTL_MS` environment variable (milliseconds, default `600000`) changes that time, for example in a `docker-compose.override.yml`.
- Every 5 seconds the worker logs a `[Worker Stats]` line with the jobs currently in the store, by status (`docker compose logs -f toy-api`, from the lab's folder).
- `ltlab restart -s toy-api` clears the queue and the store.

## Purpose

Used as a **sandbox backend** for Load Testing Lab demos and automated tests.
