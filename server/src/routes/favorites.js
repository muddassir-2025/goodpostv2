import { Router } from "express";
import { one, query } from "../db.js";
import { listTable } from "../list.js";
import { parseQueriesParam } from "../query.js";
import { serializeRow, listResponse } from "../serialize.js";
import { requireAuth } from "../auth.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { postId } = req.body || {};
    if (!postId) return res.status(400).json({ error: "postId is required" });

    const row = await one(
      `INSERT INTO favorites (user_id, post_id) VALUES ($1,$2)
       ON CONFLICT (user_id, post_id) DO NOTHING RETURNING *`,
      [req.userId, postId],
    );
    const favorite =
      row || (await one("SELECT * FROM favorites WHERE user_id = $1 AND post_id = $2", [req.userId, postId]));
    res.status(201).json(serializeRow("favorites", favorite));
  } catch (error) {
    console.error("addFavorite error:", error.message);
    res.status(500).json({ error: "Failed to add favorite" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const existing = await one("SELECT * FROM favorites WHERE id = $1", [req.params.id]);
    if (existing && existing.user_id === req.userId) {
      await query("DELETE FROM favorites WHERE id = $1", [req.params.id]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("deleteFavorite error:", error.message);
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

router.get("/", async (req, res) => {
  try {
    const queries = parseQueriesParam(req.query.queries);
    const { rows, total } = await listTable("favorites", queries);
    res.json(listResponse("favorites", rows, total));
  } catch (error) {
    console.error("getFavorites error:", error.message);
    res.status(400).json({ error: error.message });
  }
});

export default router;
