import { Router } from "express";
import { one, query } from "../db.js";
import { listTable } from "../list.js";
import { parseQueriesParam } from "../query.js";
import { serializeRow, listResponse } from "../serialize.js";
import { requireAuth } from "../auth.js";
import { createNotification } from "../notify.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { postId, userName } = req.body || {};
    if (!postId) return res.status(400).json({ error: "postId is required" });

    const row = await one(
      `INSERT INTO likes (post_id, user_id) VALUES ($1,$2)
       ON CONFLICT (post_id, user_id) DO NOTHING RETURNING *`,
      [postId, req.userId],
    );

    const post = await one("SELECT * FROM posts WHERE id = $1", [postId]);
    if (post) {
      if (row) {
        await query("UPDATE posts SET like_count = like_count + 1, updated_at = now() WHERE id = $1", [postId]);
        createNotification({
          userId: post.author_id,
          actorId: req.userId,
          actorName: userName || req.profile?.name || "Guest",
          type: "like",
          postId,
          postSlug: post.slug,
        });
      }
    }

    const like = row || (await one("SELECT * FROM likes WHERE post_id = $1 AND user_id = $2", [postId, req.userId]));
    res.status(201).json(serializeRow("likes", like));
  } catch (error) {
    console.error("createLike error:", error.message);
    res.status(500).json({ error: "Failed to like post" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const existing = await one("SELECT * FROM likes WHERE id = $1", [req.params.id]);
    if (existing && existing.user_id === req.userId) {
      await query("DELETE FROM likes WHERE id = $1", [req.params.id]);
      await query(
        "UPDATE posts SET like_count = GREATEST(like_count - 1, 0), updated_at = now() WHERE id = $1",
        [existing.post_id],
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error("deleteLike error:", error.message);
    res.status(500).json({ error: "Failed to remove like" });
  }
});

router.get("/count", async (req, res) => {
  try {
    const postId = req.query.postId;
    const row = await one("SELECT COUNT(*)::int AS total FROM likes WHERE post_id = $1", [postId]);
    res.json({ total: row?.total || 0, documents: [] });
  } catch (error) {
    console.error("countLikes error:", error.message);
    res.json({ total: 0, documents: [] });
  }
});

router.get("/", async (req, res) => {
  try {
    const queries = parseQueriesParam(req.query.queries);
    const { rows, total } = await listTable("likes", queries);
    res.json(listResponse("likes", rows, total));
  } catch (error) {
    console.error("getLikes error:", error.message);
    res.status(400).json({ error: error.message });
  }
});

export default router;
