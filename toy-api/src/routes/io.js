import { Router } from "express";
import { delay } from "../utils/delay.js";

const router = Router();

router.get("/", async (req, res) => {
  await delay(300 + Math.random() * 1200);
  res.json({ ok: true, io: "simulated" });
});

export default router;
