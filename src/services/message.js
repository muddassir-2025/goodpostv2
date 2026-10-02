import { api, withQueries } from "../api/client";
import { Query } from "../lib/appwriteCompat";
import { subscribe } from "../lib/realtime";

class MessageService {
  async getConversations(userId) {
    try {
      return await api.get(
        withQueries("/api/conversations", [
          Query.contains("members", [userId]),
          Query.orderDesc("lastMessageAt"),
          Query.limit(50),
        ]),
      );
    } catch (error) {
      console.log("getConversations error:", error.message);
      return { total: 0, documents: [] };
    }
  }

  async getConversation(conversationId) {
    try {
      return await api.get(`/api/conversations/${conversationId}`);
    } catch (error) {
      console.log("getConversation error:", error.message);
      return null;
    }
  }

  async getConversationByMembers(userId1, userId2) {
    try {
      return await api.get(
        `/api/conversations/by-members?userId1=${encodeURIComponent(userId1)}&userId2=${encodeURIComponent(userId2)}`,
      );
    } catch (error) {
      console.log("getConversationByMembers error:", error.message);
      return null;
    }
  }

  async createConversation(members) {
    return api.post("/api/conversations", { members });
  }

  async getMessages(conversationId, limit = 100) {
    try {
      return await api.get(
        withQueries("/api/messages", [
          Query.equal("conversationId", conversationId),
          Query.orderDesc("$createdAt"),
          Query.limit(limit),
        ]),
      );
    } catch (error) {
      console.log("getMessages error:", error.message);
      return { total: 0, documents: [] };
    }
  }

  async sendMessage(conversationId, senderId, text, messageId, imageId) {
    return api.post("/api/messages", {
      conversationId,
      text: text || "",
      messageId: messageId || null,
      imageId: imageId || null,
    });
  }

  async markSeen(conversationId) {
    try {
      return await api.post(`/api/conversations/${conversationId}/seen`, {});
    } catch (error) {
      console.log("markSeen error:", error.message);
      return null;
    }
  }

  async editMessage(messageId, newText) {
    return api.patch(`/api/messages/${messageId}`, { text: newText });
  }

  async deleteMessage(messageId) {
    return api.delete(`/api/messages/${messageId}`);
  }

  async clearChat(conversationId) {
    return api.post(`/api/conversations/${conversationId}/clear`, {});
  }

  async deleteConversation(conversationId) {
    return api.delete(`/api/conversations/${conversationId}`);
  }

  // ---- realtime (WebSocket) ----

  subscribeToMessages(conversationId, callback) {
    const unsubscribers = ["message:create", "message:update"].map((type) =>
      subscribe(type, (payload) => {
        if (payload?.conversationId === conversationId) {
          callback(payload, false);
        }
      }),
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }

  subscribeToConversations(userId, callback) {
    const unsubscribers = ["conversation:create", "conversation:update", "conversation:delete"].map((type) =>
      subscribe(type, (payload) => {
        if (payload?.members?.includes(userId) || payload?.$id) {
          if (!payload.members || payload.members.includes(userId)) callback(payload, type);
        }
      }),
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }

  /**
   * Conversations with an unread inbound message. The navbar and the notifications page
   * both need this, and each was fetching conversations plus a per-conversation message
   * lookup. Doing it once here halves the requests on every page that shows a badge.
   */
  async getUnreadInbox(userId) {
    const conversations = (await this.getConversations(userId))?.documents || [];
    const unread = conversations.filter((c) => c.unreadCount > 0 && c.lastMessage);

    const latest = await Promise.all(
      unread.map(async (conversation) => {
        const messages = (await this.getMessages(conversation.$id, 1))?.documents || [];
        const last = messages[0];
        if (!last || last.senderId === userId) return null;
        const otherId = (conversation.members || []).find((id) => id !== userId) || null;
        return {
          conversationId: conversation.$id,
          senderId: last.senderId,
          otherId,
          text: conversation.lastMessage,
          at: conversation.lastMessageAt,
        };
      }),
    );

    return latest.filter(Boolean);
  }
}

const messageService = new MessageService();
export default messageService;
