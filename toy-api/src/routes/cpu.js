import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
  let total = 0;
  for (let i = 0; i < 10_000_000; i++) {
    total += Math.sqrt(i);
  }
  res.json({ ok: true, cpu: total });
});

export default router;
