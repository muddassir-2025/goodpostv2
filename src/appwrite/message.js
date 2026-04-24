import { Client, Databases, ID, Query } from "appwrite";

class MessageService {
  client = new Client();
  databases;

  constructor() {
    this.client
      .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
      .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

    this.databases = new Databases(this.client);
  }

  get databaseId() {
    return import.meta.env.VITE_APPWRITE_DATABASE_ID;
  }

  get conversationsId() {
    return import.meta.env.VITE_APPWRITE_CONVERSATIONS_ID || "conversations";
  }

  get messagesId() {
    return import.meta.env.VITE_APPWRITE_MESSAGES_ID || "messages";
  }

  // ✅ Get all conversations for a user
  async getConversations(userId) {
    try {
      return await this.databases.listDocuments(
        this.databaseId,
        this.conversationsId,
        [
          Query.contains("members", [userId]),
          Query.orderDesc("lastMessageAt"),
          Query.limit(50),
        ]
      );
    } catch (error) {
      console.log("getConversations error:", error);
      return { documents: [] };
    }
  }

  // ✅ Get specific conversation
  async getConversation(conversationId) {
    try {
      return await this.databases.getDocument(
        this.databaseId,
        this.conversationsId,
        conversationId
      );
    } catch (error) {
      console.log("getConversation error:", error);
      return null;
    }
  }

  // ✅ Find conversation by members
  async getConversationByMembers(userId1, userId2) {
    try {
      // Appwrite queries on arrays can be tricky, but if we query contains for both, it works.
      const res = await this.databases.listDocuments(
        this.databaseId,
        this.conversationsId,
        [
          Query.contains("members", [userId1]),
          Query.contains("members", [userId2]),
          Query.limit(1)
        ]
      );
      return res.documents[0] || null;
    } catch (error) {
      console.log("getConversationByMembers error:", error);
      return null;
    }
  }

  // ✅ Create conversation
  async createConversation(members) {
    try {
      return await this.databases.createDocument(
        this.databaseId,
        this.conversationsId,
        ID.unique(),
        {
          members,
          lastMessage: "",
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0,
        }
      );
    } catch (error) {
      console.log("createConversation error:", error);
      throw error;
    }
  }

  // ✅ Get messages for a conversation
  async getMessages(conversationId) {
    try {
      return await this.databases.listDocuments(
        this.databaseId,
        this.messagesId,
        [
          Query.equal("conversationId", conversationId),
          Query.orderAsc("createdAt"), // Order by oldest first for chat history
          Query.limit(100),
        ]
      );
    } catch (error) {
      console.log("getMessages error:", error);
      return { documents: [] };
    }
  }

  // ✅ Send a message
  async sendMessage(conversationId, senderId, text, messageId = ID.unique()) {
    try {
      const now = new Date().toISOString();
      const message = await this.databases.createDocument(
        this.databaseId,
        this.messagesId,
        messageId,
        {
          conversationId,
          senderId,
          text,
          createdAt: now,
          seen: false,
        }
      );

      // Update conversation's last message info
      const conversation = await this.getConversation(conversationId);
      if (conversation) {
        await this.databases.updateDocument(
          this.databaseId,
          this.conversationsId,
          conversationId,
          {
            lastMessage: text,
            lastMessageAt: now,
            unreadCount: (conversation.unreadCount || 0) + 1,
          }
        );
      }

      return message;
    } catch (error) {
      console.log("sendMessage error:", error);
      throw error;
    }
  }

  // ✅ Mark messages as seen
  async markSeen(conversationId) {
    try {
      await this.databases.updateDocument(
        this.databaseId,
        this.conversationsId,
        conversationId,
        {
          unreadCount: 0,
        }
      );
    } catch (error) {
      console.log("markSeen error:", error);
    }
  }

  // ✅ Edit a message
  async editMessage(messageId, newText) {
    try {
      return await this.databases.updateDocument(
        this.databaseId,
        this.messagesId,
        messageId,
        {
          text: newText,
        }
      );
    } catch (error) {
      console.log("editMessage error:", error);
      throw error;
    }
  }

  // ✅ Delete a message (WhatsApp style)
  async deleteMessage(messageId) {
    try {
      return await this.databases.updateDocument(
        this.databaseId,
        this.messagesId,
        messageId,
        {
          text: "🚫 This message was deleted",
        }
      );
    } catch (error) {
      console.log("deleteMessage error:", error);
      throw error;
    }
  }

  // ✅ Real-time subscription
  subscribeToMessages(conversationId, callback) {
    return this.client.subscribe(
      `databases.${this.databaseId}.collections.${this.messagesId}.documents`,
      (response) => {
        // Appwrite realtime event payload
        if (
          response.events.includes(`databases.${this.databaseId}.collections.${this.messagesId}.documents.*.create`) ||
          response.events.includes(`databases.${this.databaseId}.collections.${this.messagesId}.documents.*.update`) ||
          response.events.includes(`databases.${this.databaseId}.collections.${this.messagesId}.documents.*.delete`)
        ) {
           if (response.payload.conversationId === conversationId) {
             callback(response.payload, response.events.some(e => e.endsWith('.delete')));
           }
        }
      }
    );
  }

  // ✅ Real-time subscription for conversations
  subscribeToConversations(userId, callback) {
    return this.client.subscribe(
      `databases.${this.databaseId}.collections.${this.conversationsId}.documents`,
      (response) => {
        if (
          response.events.includes(`databases.${this.databaseId}.collections.${this.conversationsId}.documents.*.create`) ||
          response.events.includes(`databases.${this.databaseId}.collections.${this.conversationsId}.documents.*.update`)
        ) {
           if (response.payload.members.includes(userId)) {
             callback(response.payload);
           }
        }
      }
    );
  }

  // ✅ Clear chat (Delete all messages in a conversation)
  async clearChat(conversationId) {
    try {
      const messages = await this.getMessages(conversationId);
      const deletePromises = (messages?.documents || []).map((msg) =>
        this.databases.deleteDocument(this.databaseId, this.messagesId, msg.$id)
      );
      await Promise.all(deletePromises);
      
      // Update conversation last message
      await this.databases.updateDocument(
        this.databaseId,
        this.conversationsId,
        conversationId,
        {
          lastMessage: "Chat cleared",
          unreadCount: 0,
        }
      );
    } catch (error) {
      console.log("clearChat error:", error);
      throw error;
    }
  }

  // ✅ Delete Conversation
  async deleteConversation(conversationId) {
    try {
      // First clear all messages
      await this.clearChat(conversationId);
      // Then delete conversation document
      await this.databases.deleteDocument(
        this.databaseId,
        this.conversationsId,
        conversationId
      );
    } catch (error) {
      console.log("deleteConversation error:", error);
      throw error;
    }
  }
}

const messageService = new MessageService();
export default messageService;
