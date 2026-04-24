import { Client, Databases, ID, Query, Permission, Role } from "appwrite";

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

  get messagesCollectionId() {
    return import.meta.env.VITE_APPWRITE_MESSAGES_ID || "messages";
  }

  // ✅ Send Message
  async sendMessage({ senderId, receiverId, content, senderName }) {
    try {
      return await this.databases.createDocument(
        this.databaseId,
        this.messagesCollectionId,
        ID.unique(),
        {
          senderId,
          receiverId,
          content,
          senderName,
          status: "sent",
        },
        [
          Permission.read(Role.user(senderId)),
          Permission.read(Role.user(receiverId)),
          Permission.write(Role.user(senderId)),
        ]
      );
    } catch (error) {
      console.error("Send message error:", error);
      throw error;
    }
  }

  // ✅ Get Messages between two users
  async getMessages(myId, otherId) {
    try {
      const res = await this.databases.listDocuments(
        this.databaseId,
        this.messagesCollectionId,
        [
          Query.or([
            Query.and([Query.equal("senderId", myId), Query.equal("receiverId", otherId)]),
            Query.and([Query.equal("senderId", otherId), Query.equal("receiverId", myId)]),
          ]),
          Query.orderAsc("$createdAt"),
          Query.limit(100),
        ]
      );
      return res.documents;
    } catch (error) {
      console.error("Get messages error:", error);
      return [];
    }
  }

  // ✅ Get Conversations (Recent chats)
  async getConversations(myId) {
    try {
      const res = await this.databases.listDocuments(
        this.databaseId,
        this.messagesCollectionId,
        [
          Query.or([
            Query.equal("senderId", myId),
            Query.equal("receiverId", myId),
          ]),
          Query.orderDesc("$createdAt"),
          Query.limit(100),
        ]
      );

      // Group by other user and pick the latest message
      const threads = {};
      res.documents.forEach((msg) => {
        const otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
        if (!threads[otherId]) {
          threads[otherId] = msg;
        }
      });

      return Object.values(threads);
    } catch (error) {
      console.error("Get conversations error:", error);
      return [];
    }
  }

  // ✅ Real-time Subscription
  subscribe(callback) {
    const channel = `databases.${this.databaseId}.collections.${this.messagesCollectionId}.documents`;
    return this.client.subscribe(channel, (response) => {
      callback(response);
    });
  }
}

const messageService = new MessageService();
export default messageService;
