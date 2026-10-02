import { Router } from "express";
import { many, one, query } from "../db.js";
import { serializeUser, serializeRow } from "../serialize.js";
import { requireAuth } from "../auth.js";

const router = Router();

function initials(name = "Guest") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function publicProfile(profile) {
  if (!profile) return null;
  return {
    ...serializeUser(profile),
    initials: initials(profile.name),
  };
}

// Profile for the authenticated user (upsert happens in attachUser).
router.get("/me", requireAuth, async (req, res) => {
  res.json(publicProfile(req.profile));
});

// Update bio / avatar / name. `profile` row is the source of truth for app data.
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const name = body.name ?? req.profile.name;
    const bio = body.bio ?? req.profile.bio ?? "";
    const avatarId = body.avatarId ?? req.profile.avatar_id ?? null;

    const row = await one(
      `UPDATE profiles SET name = $2, bio = $3, avatar_id = $4, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.userId, name, bio, avatarId],
    );
    res.json(publicProfile(row));
  } catch (error) {
    console.error("updateProfile error:", error.message);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.patch("/me/name", requireAuth, async (req, res) => {
  try {
    const row = await one(
      "UPDATE profiles SET name = $2, updated_at = now() WHERE id = $1 RETURNING *",
      [req.userId, req.body?.name ?? req.profile.name],
    );
    // Keep author names on existing posts in sync for a consistent feed.
    await query("UPDATE posts SET author_name = $2 WHERE author_id = $1", [req.userId, row.name]);
    res.json(publicProfile(row));
  } catch (error) {
    console.error("updateName error:", error.message);
    res.status(500).json({ error: "Failed to update name" });
  }
});

// Delete the authenticated user's content (auth account removal happens via the auth provider).
router.delete("/me", requireAuth, async (req, res) => {
  try {
    await query("DELETE FROM posts WHERE author_id = $1", [req.userId]);
    await query("DELETE FROM comments WHERE user_id = $1", [req.userId]);
    await query("DELETE FROM likes WHERE user_id = $1", [req.userId]);
    await query("DELETE FROM favorites WHERE user_id = $1", [req.userId]);
    await query("DELETE FROM follows WHERE follower_id = $1 OR following_id = $1", [req.userId]);
    await query("DELETE FROM notifications WHERE user_id = $1 OR actor_id = $1", [req.userId]);
    await query("DELETE FROM profiles WHERE id = $1", [req.userId]);
    res.json({ success: true });
  } catch (error) {
    console.error("deleteAccount error:", error.message);
    res.status(500).json({ error: "Failed to delete account data" });
  }
});

// Public profile lookup.
router.get("/:id", async (req, res) => {
  try {
    const row = await one("SELECT * FROM profiles WHERE id = $1", [req.params.id]);
    res.json(publicProfile(row));
  } catch (error) {
    console.error("getUser error:", error.message);
    res.status(500).json({ error: "Failed to load user" });
  }
});

// Lightweight user search for the messages page.
router.get("/", async (req, res) => {
  try {
    const term = req.query.search || "";
    const rows = term
      ? await many(
          `SELECT * FROM profiles WHERE name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' LIMIT 30`,
          [term],
        )
      : await many("SELECT * FROM profiles ORDER BY created_at DESC LIMIT 30");
    res.json({ total: rows.length, documents: rows.map(publicProfile) });
  } catch (error) {
    console.error("searchUsers error:", error.message);
    res.json({ total: 0, documents: [] });
  }
});

export default router;
