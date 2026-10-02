import { Router } from "express";
import { many, one } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { serializeUser, serializeRow } from "../serialize.js";
import { metrics } from "../monitoring.js";
import { moderationState } from "../moderation.js";
import { storageHealth } from "../storage.js";

const router = Router();

// Everything under /api/admin requires an authenticated admin.
router.use(requireAuth, requireAdmin);

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

// List / search users.
router.get("/users", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const limit = clampInt(req.query.limit, 50, 1, 200);
    const offset = clampInt(req.query.offset, 0, 0, 1_000_000);

    const filter = search
      ? "WHERE name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%'"
      : "";
    const filterParams = search ? [search] : [];

    const rows = search
      ? await many(
          `SELECT * FROM profiles ${filter} ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
          [...filterParams, limit, offset],
        )
      : await many("SELECT * FROM profiles ORDER BY created_at DESC LIMIT $1 OFFSET $2", [
          limit,
          offset,
        ]);

    const totalRow = await one(`SELECT count(*)::int AS count FROM profiles ${filter}`, filterParams);

    res.json({ total: totalRow?.count ?? rows.length, documents: rows.map(serializeUser) });
  } catch (error) {
    console.error("admin listUsers error:", error.message);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// Promote or demote a user.
router.patch("/users/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const isAdmin = Boolean(req.body?.isAdmin);

    // Don't let an admin lock themselves out.
    if (!isAdmin && id === req.userId) {
      return res.status(400).json({ error: "You cannot remove your own admin access" });
    }

    const row = await one(
      "UPDATE profiles SET is_admin = $2, updated_at = now() WHERE id = $1 RETURNING *",
      [id, isAdmin],
    );
    if (!row) return res.status(404).json({ error: "User not found" });

    res.json(serializeUser(row));
  } catch (error) {
    console.error("admin setAdmin error:", error.message);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Posts that users have reported, worst first.
router.get("/posts/reported", async (_req, res) => {
  try {
    const rows = await many(
      "SELECT * FROM posts WHERE report_count > 0 ORDER BY report_count DESC, created_at DESC LIMIT 100",
    );
    res.json({ total: rows.length, documents: rows.map((row) => serializeRow("posts", row)) });
  } catch (error) {
    console.error("admin reportedPosts error:", error.message);
    res.status(500).json({ error: "Failed to load reported posts" });
  }
});

// Counts + process health for the admin dashboard.
router.get("/stats", async (_req, res) => {
  try {
    const [posts, users, comments, reported] = await Promise.all([
      one("SELECT count(*)::int AS count FROM posts"),
      one("SELECT count(*)::int AS count FROM profiles"),
      one("SELECT count(*)::int AS count FROM comments"),
      one("SELECT count(*)::int AS count FROM posts WHERE report_count > 0"),
    ]);

    res.json({
      counts: {
        posts: posts?.count ?? 0,
        users: users?.count ?? 0,
        comments: comments?.count ?? 0,
        reportedPosts: reported?.count ?? 0,
      },
      process: metrics(),
      moderation: moderationState(),
      // Admin-only, so the full problem list is safe to expose here.
      storage: storageHealth(),
    });
  } catch (error) {
    console.error("admin stats error:", error.message);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

export default router;
