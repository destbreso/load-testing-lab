import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
  res.json({ ok: true, speed: "fast", ts: Date.now() });
});

export default router;
