import { Router } from "express";
import { many } from "../db.js";
import { listResponse } from "../serialize.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await many("SELECT * FROM stories ORDER BY created_at DESC LIMIT 100");
    res.json(listResponse("stories", rows, rows.length));
  } catch (error) {
    console.error("getStories error:", error.message);
    res.json({ total: 0, documents: [] });
  }
});

export default router;
