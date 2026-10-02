import { Router } from "express";
import { many, one, query } from "../db.js";
import { serializeRow, listResponse } from "../serialize.js";
import { requireAuth } from "../auth.js";
import { createNotification } from "../notify.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { followingId, followerName } = req.body || {};
    const followerId = req.userId;
    if (!followingId) return res.status(400).json({ error: "followingId is required" });
    if (followerId === followingId) return res.status(400).json({ error: "You cannot follow yourself" });

    const row = await one(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1,$2)
       ON CONFLICT (follower_id, following_id) DO NOTHING RETURNING *`,
      [followerId, followingId],
    );

    if (row) {
      createNotification({
        userId: followingId,
        actorId: followerId,
        actorName: followerName || req.profile?.name || "Guest",
        type: "follow",
      });
    }
    res.status(201).json(row ? serializeRow("follows", row) : null);
  } catch (error) {
    console.error("followUser error:", error.message);
    res.status(500).json({ error: "Failed to follow user" });
  }
});

router.delete("/", requireAuth, async (req, res) => {
  try {
    await query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2", [
      req.userId,
      req.query.followingId,
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error("unfollowUser error:", error.message);
    res.status(500).json({ error: "Failed to unfollow user" });
  }
});

router.get("/status", requireAuth, async (req, res) => {
  try {
    const row = await one(
      "SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2",
      [req.userId, req.query.followingId],
    );
    res.json({ following: Boolean(row) });
  } catch (error) {
    console.error("isFollowing error:", error.message);
    res.json({ following: false });
  }
});

router.get("/count", async (req, res) => {
  try {
    const { userId, type } = req.query;
    const column = type === "following" ? "follower_id" : "following_id";
    const row = await one(`SELECT COUNT(*)::int AS total FROM follows WHERE ${column} = $1`, [userId]);
    res.json({ total: row?.total || 0 });
  } catch (error) {
    console.error("followCount error:", error.message);
    res.json({ total: 0 });
  }
});

router.get("/following", async (req, res) => {
  try {
    const rows = await many(
      "SELECT following_id FROM follows WHERE follower_id = $1",
      [req.query.userId],
    );
    res.json({ ids: rows.map((r) => r.following_id) });
  } catch (error) {
    console.error("getFollowing error:", error.message);
    res.json({ ids: [] });
  }
});

router.get("/followers", async (req, res) => {
  try {
    const rows = await many(
      "SELECT follower_id FROM follows WHERE following_id = $1",
      [req.query.userId],
    );
    res.json({ ids: rows.map((r) => r.follower_id) });
  } catch (error) {
    console.error("getFollowers error:", error.message);
    res.json({ ids: [] });
  }
});

router.get("/", async (req, res) => {
  try {
    const rows = await many("SELECT * FROM follows WHERE follower_id = $1 OR following_id = $1", [
      req.query.userId,
    ]);
    res.json(listResponse("follows", rows, rows.length));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
