import { Router } from "express";
import { many, one, query } from "../db.js";
import { listTable } from "../list.js";
import { parseQueriesParam } from "../query.js";
import { serializeRow, listResponse } from "../serialize.js";
import { requireAuth } from "../auth.js";
import { createNotification } from "../notify.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { postId, content, parentId = null } = req.body || {};
    if (!postId || !content) return res.status(400).json({ error: "postId and content are required" });

    const row = await one(
      `INSERT INTO comments (post_id, user_id, user_name, content, parent_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [postId, req.userId, req.profile?.name || "Guest", content, parentId],
    );

    const post = await one("SELECT * FROM posts WHERE id = $1", [postId]);
    if (post) {
      await query("UPDATE posts SET comment_count = comment_count + 1, updated_at = now() WHERE id = $1", [postId]);
      createNotification({
        userId: post.author_id,
        actorId: req.userId,
        actorName: req.profile?.name || "Guest",
        type: "comment",
        postId,
        postSlug: post.slug,
        content,
      });
    }

    res.status(201).json(serializeRow("comments", row));
  } catch (error) {
    console.error("createComment error:", error.message);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

router.get("/", async (req, res) => {
  try {
    const queries = parseQueriesParam(req.query.queries);
    const { rows, total } = await listTable("comments", queries, {
      defaultOrder: "ORDER BY created_at ASC",
    });
    res.json(listResponse("comments", rows, total));
  } catch (error) {
    console.error("getComments error:", error.message);
    res.status(400).json({ error: error.message });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const existing = await one("SELECT * FROM comments WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Comment not found" });
    if (existing.user_id !== req.userId && !req.profile?.is_admin) {
      return res.status(403).json({ error: "Not allowed" });
    }
    const row = await one(
      "UPDATE comments SET content = $2, updated_at = now() WHERE id = $1 RETURNING *",
      [req.params.id, req.body?.content ?? existing.content],
    );
    res.json(serializeRow("comments", row));
  } catch (error) {
    console.error("updateComment error:", error.message);
    res.status(500).json({ error: "Failed to update comment" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const existing = await one("SELECT * FROM comments WHERE id = $1", [req.params.id]);
    if (!existing) return res.json({ success: true });
    if (existing.user_id !== req.userId && !req.profile?.is_admin) {
      return res.status(403).json({ error: "Not allowed" });
    }
    await query("DELETE FROM comments WHERE id = $1", [req.params.id]);
    await query(
      "UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0), updated_at = now() WHERE id = $1",
      [existing.post_id],
    );
    res.json({ success: true });
  } catch (error) {
    console.error("deleteComment error:", error.message);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

export default router;
