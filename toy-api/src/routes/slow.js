import { Router } from "express";
import { delay } from "../utils/delay.js";

const router = Router();

router.get("/", async (req, res) => {
  await delay(500 + Math.random() * 2000);
  res.json({ ok: true, speed: "slow" });
});

export default router;
