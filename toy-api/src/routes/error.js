import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
  if (Math.random() < 0.3) {
    return res.status(500).json({ error: "Random failure" });
  }
  res.json({ ok: true });
});

export default router;
