import express from "express";
import cors from "cors";
import morgan from "morgan";

import "./workers/fakeWorker.js";

import fast from "./routes/fast.js";
import slow from "./routes/slow.js";
import error from "./routes/error.js";
import cpu from "./routes/cpu.js";
import io from "./routes/io.js";
import users from "./routes/users.js";
import jobs from "./routes/jobs.js";
import health from "./routes/health.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/health", health);
app.use("/fast", fast);
app.use("/slow", slow);
app.use("/error", error);
app.use("/cpu", cpu);
app.use("/io", io);
app.use("/users", users);
app.use("/jobs", jobs);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Toy API running on http://localhost:${PORT}`);
});
