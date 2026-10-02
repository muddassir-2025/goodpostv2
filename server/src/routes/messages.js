import { Router } from "express";
import { many, one, query } from "../db.js";
import { listTable } from "../list.js";
import { parseQueriesParam } from "../query.js";
import { serializeRow, listResponse } from "../serialize.js";
import { requireAuth } from "../auth.js";
import { emitToUsers } from "../realtime.js";

const router = Router();

/* ------------------------------- conversations ------------------------------ */

router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const queries = parseQueriesParam(req.query.queries);
    const { rows, total } = await listTable("conversations", queries, {
      defaultOrder: "ORDER BY last_message_at DESC",
    });
    res.json(listResponse("conversations", rows, total));
  } catch (error) {
    console.error("getConversations error:", error.message);
    res.json({ total: 0, documents: [] });
  }
});

router.get("/conversations/by-members", requireAuth, async (req, res) => {
  try {
    const { userId1, userId2 } = req.query;
    const row = await one(
      `SELECT * FROM conversations
       WHERE members @> ARRAY[$1,$2]::uuid[]
       ORDER BY last_message_at DESC LIMIT 1`,
      [userId1, userId2],
    );
    res.json(row ? serializeRow("conversations", row) : null);
  } catch (error) {
    console.error("getConversationByMembers error:", error.message);
    res.json(null);
  }
});

router.post("/conversations", requireAuth, async (req, res) => {
  try {
    const members = Array.isArray(req.body?.members) ? req.body.members : [];
    if (members.length < 2) return res.status(400).json({ error: "At least two members are required" });

    const row = await one(
      `INSERT INTO conversations (members, last_message, last_message_at, unread_count)
       VALUES ($1,$2,now(),0) RETURNING *`,
      [members, ""],
    );
    const doc = serializeRow("conversations", row);
    emitToUsers(members, "conversation:create", doc);
    res.status(201).json(doc);
  } catch (error) {
    console.error("createConversation error:", error.message);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", requireAuth, async (req, res) => {
  try {
    const row = await one("SELECT * FROM conversations WHERE id = $1", [req.params.id]);
    res.json(row ? serializeRow("conversations", row) : null);
  } catch (error) {
    console.error("getConversation error:", error.message);
    res.json(null);
  }
});

router.post("/conversations/:id/seen", requireAuth, async (req, res) => {
  try {
    const row = await one(
      "UPDATE conversations SET unread_count = 0 WHERE id = $1 RETURNING *",
      [req.params.id],
    );
    if (row) emitToUsers(row.members, "conversation:update", serializeRow("conversations", row));
    res.json(row ? serializeRow("conversations", row) : null);
  } catch (error) {
    console.error("markSeen error:", error.message);
    res.status(500).json({ error: "Failed to mark seen" });
  }
});

router.post("/conversations/:id/clear", requireAuth, async (req, res) => {
  try {
    await query("DELETE FROM messages WHERE conversation_id = $1", [req.params.id]);
    const row = await one(
      "UPDATE conversations SET last_message = 'Chat cleared', unread_count = 0 WHERE id = $1 RETURNING *",
      [req.params.id],
    );
    if (row) emitToUsers(row.members, "conversation:clear", serializeRow("conversations", row));
    res.json({ success: true });
  } catch (error) {
    console.error("clearChat error:", error.message);
    res.status(500).json({ error: "Failed to clear chat" });
  }
});

router.delete("/conversations/:id", requireAuth, async (req, res) => {
  try {
    const row = await one("SELECT * FROM conversations WHERE id = $1", [req.params.id]);
    await query("DELETE FROM conversations WHERE id = $1", [req.params.id]);
    if (row) emitToUsers(row.members, "conversation:delete", { $id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error("deleteConversation error:", error.message);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

/* --------------------------------- messages -------------------------------- */

router.get("/messages", requireAuth, async (req, res) => {
  try {
    const queries = parseQueriesParam(req.query.queries);
    const { rows, total } = await listTable("messages", queries, {
      defaultOrder: "ORDER BY created_at DESC",
    });
    res.json(listResponse("messages", rows, total));
  } catch (error) {
    console.error("getMessages error:", error.message);
    res.json({ total: 0, documents: [] });
  }
});

router.post("/messages", requireAuth, async (req, res) => {
  try {
    const { conversationId, text, messageId = null } = req.body || {};
    if (!conversationId || !text) {
      return res.status(400).json({ error: "conversationId and text are required" });
    }

    const message = await one(
      `INSERT INTO messages (id, conversation_id, sender_id, text)
       VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4) RETURNING *`,
      [messageId, conversationId, req.userId, text],
    );

    const conversation = await one(
      `UPDATE conversations
       SET last_message = $2, last_message_at = now(), unread_count = unread_count + 1
       WHERE id = $1 RETURNING *`,
      [conversationId, text],
    );

    const messageDoc = serializeRow("messages", message);
    if (conversation) {
      emitToUsers(conversation.members, "message:create", messageDoc);
      emitToUsers(conversation.members, "conversation:update", serializeRow("conversations", conversation));
    }
    res.status(201).json(messageDoc);
  } catch (error) {
    console.error("sendMessage error:", error.message);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.patch("/messages/:id", requireAuth, async (req, res) => {
  try {
    const existing = await one("SELECT * FROM messages WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Message not found" });
    if (existing.sender_id !== req.userId) return res.status(403).json({ error: "Not allowed" });

    const row = await one("UPDATE messages SET text = $2 WHERE id = $1 RETURNING *", [
      req.params.id,
      req.body?.text ?? existing.text,
    ]);
    const conversation = await one("SELECT members FROM conversations WHERE id = $1", [existing.conversation_id]);
    if (conversation) emitToUsers(conversation.members, "message:update", serializeRow("messages", row));
    res.json(serializeRow("messages", row));
  } catch (error) {
    console.error("editMessage error:", error.message);
    res.status(500).json({ error: "Failed to edit message" });
  }
});

router.delete("/messages/:id", requireAuth, async (req, res) => {
  try {
    const existing = await one("SELECT * FROM messages WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Message not found" });
    if (existing.sender_id !== req.userId) return res.status(403).json({ error: "Not allowed" });

    const row = await one(
      "UPDATE messages SET text = '🚫 This message was deleted' WHERE id = $1 RETURNING *",
      [req.params.id],
    );
    const conversation = await one("SELECT members FROM conversations WHERE id = $1", [existing.conversation_id]);
    if (conversation) emitToUsers(conversation.members, "message:update", serializeRow("messages", row));
    res.json(serializeRow("messages", row));
  } catch (error) {
    console.error("deleteMessage error:", error.message);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

export default router;
