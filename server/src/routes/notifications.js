import { Router } from "express";
import { one, query } from "../db.js";
import { listTable } from "../list.js";
import { parseQueriesParam } from "../query.js";
import { serializeRow, listResponse } from "../serialize.js";
import { requireAuth } from "../auth.js";
import { emitToUser } from "../realtime.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const queries = parseQueriesParam(req.query.queries);
    const { rows, total } = await listTable("notifications", queries, {
      defaultOrder: "ORDER BY created_at DESC",
    });
    res.json(listResponse("notifications", rows, total));
  } catch (error) {
    console.error("getUserNotifications error:", error.message);
    res.json({ total: 0, documents: [] });
  }
});

router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const row = await one(
      "SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1 AND is_read = false",
      [req.userId],
    );
    res.json({ total: row?.total || 0 });
  } catch (error) {
    res.json({ total: 0 });
  }
});

router.post("/read-all", requireAuth, async (req, res) => {
  try {
    await query("UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false", [
      req.userId,
    ]);
    emitToUser(req.userId, "notification:update", { allRead: true });
    res.json({ success: true });
  } catch (error) {
    console.error("markAllAsRead error:", error.message);
    res.status(500).json({ error: "Failed to mark notifications read" });
  }
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    const row = await one(
      "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *",
      [req.params.id, req.userId],
    );
    if (row) emitToUser(req.userId, "notification:update", serializeRow("notifications", row));
    res.json(row ? serializeRow("notifications", row) : { success: true });
  } catch (error) {
    console.error("markAsRead error:", error.message);
    res.status(500).json({ error: "Failed to mark notification read" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await query("DELETE FROM notifications WHERE id = $1 AND user_id = $2", [
      req.params.id,
      req.userId,
    ]);
    emitToUser(req.userId, "notification:delete", { $id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error("deleteNotification error:", error.message);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

router.delete("/", requireAuth, async (req, res) => {
  try {
    await query("DELETE FROM notifications WHERE user_id = $1", [req.userId]);
    emitToUser(req.userId, "notification:delete", { all: true });
    res.json({ success: true });
  } catch (error) {
    console.error("deleteAllNotifications error:", error.message);
    res.status(500).json({ error: "Failed to delete notifications" });
  }
});

export default router;
