import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
  const users = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@test.com`,
  }));

  res.json(users);
});

export default router;
