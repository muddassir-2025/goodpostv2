import { Router } from "express";
import { many, one, query } from "../db.js";
import { serializeRow, listResponse } from "../serialize.js";
import { requireAuth } from "../auth.js";
import { deleteObject } from "../storage.js";

const router = Router();

// Stories disappear after a day — the Appwrite-era code never enforced that, so old rows
// would have shown forever. `image_url` holds the storage object KEY (same convention as
// posts.featured_img); the client resolves it to a URL.
const STORY_TTL_HOURS = 24;

/** Live (unexpired) stories, newest first. */
router.get("/", async (_req, res) => {
  try {
    const rows = await many(
      `SELECT * FROM stories
       WHERE created_at > now() - ($1 || ' hours')::interval
       ORDER BY created_at DESC
       LIMIT 200`,
      [STORY_TTL_HOURS],
    );
    res.json(listResponse("stories", rows, rows.length));
  } catch (error) {
    console.error("getStories error:", error.message);
    res.json({ total: 0, documents: [] });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const imageId = req.body?.imageId || req.body?.imageUrl;
    if (!imageId) return res.status(400).json({ error: "imageId is required" });

    const row = await one(
      `INSERT INTO stories (user_id, user_name, image_url)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.userId, req.profile?.name || req.body?.userName || "Guest", imageId],
    );
    res.status(201).json(serializeRow("stories", row));
  } catch (error) {
    console.error("createStory error:", error.message);
    res.status(500).json({ error: "Failed to create story" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const existing = await one("SELECT * FROM stories WHERE id = $1", [req.params.id]);
    if (!existing) return res.json({ success: true });
    if (existing.user_id !== req.userId && !req.profile?.is_admin) {
      return res.status(403).json({ error: "Not allowed" });
    }

    await query("DELETE FROM stories WHERE id = $1", [req.params.id]);
    if (existing.image_url) await deleteObject(existing.image_url).catch(() => null);
    res.json({ success: true });
  } catch (error) {
    console.error("deleteStory error:", error.message);
    res.status(500).json({ error: "Failed to delete story" });
  }
});

export default router;
