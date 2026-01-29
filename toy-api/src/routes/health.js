import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

export default router;
