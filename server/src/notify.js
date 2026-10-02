import { many, one } from "./db.js";
import { serializeRow } from "./serialize.js";
import { emitToUser } from "./realtime.js";

const MAX_NOTIFICATIONS = 15;

/**
 * Create a notification for `userId` and push it over the user's WebSocket channel.
 * Mirrors the old Appwrite notificationService.createNotification behaviour.
 */
export async function createNotification({
  userId,
  actorId,
  actorName,
  type,
  postId = null,
  postSlug = null,
  content = null,
}) {
  if (!userId || userId === actorId) return null;

  try {
    const row = await one(
      `INSERT INTO notifications (user_id, actor_id, actor_name, type, post_id, post_slug, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, actorId || null, actorName || "Guest", type, postId, postSlug, content],
    );

    // Keep only the newest N notifications for this user.
    const stale = await many(
      `SELECT id FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       OFFSET $2`,
      [userId, MAX_NOTIFICATIONS],
    );
    if (stale.length) {
      await many(
        `DELETE FROM notifications WHERE id = ANY($1::uuid[])`,
        [stale.map((n) => n.id)],
      );
    }

    const doc = serializeRow("notifications", row);
    emitToUser(userId, "notification:create", doc);
    return doc;
  } catch (error) {
    console.error("createNotification error:", error.message);
    return null;
  }
}
