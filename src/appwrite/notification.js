import { Client, Databases, ID, Query, Permission, Role } from "appwrite";

class NotificationService {
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

  get notificationsCollectionId() {
    return import.meta.env.VITE_APPWRITE_NOTIFICATIONS_ID || "notifications";
  }

  async createNotification({ userId, actorId, type, postId = null }) {
    if (userId === actorId) return null; // Don't notify yourself

    try {
      return await this.databases.createDocument(
        this.databaseId,
        this.notificationsCollectionId,
        ID.unique(),
        {
          userId,
          actorId,
          type,
          postId,
          isRead: false,
        },
        [
          Permission.read(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ]
      );
    } catch (error) {
      console.error("Create notification error:", error);
    }
  }

  async getUserNotifications(userId) {
    try {
      return await this.databases.listDocuments(
        this.databaseId,
        this.notificationsCollectionId,
        [
          Query.equal("userId", userId),
          Query.orderDesc("$createdAt"),
          Query.limit(50),
        ]
      );
    } catch (error) {
      console.error("Get notifications error:", error);
      return { documents: [] };
    }
  }

  async markAsRead(notificationId) {
    try {
      return await this.databases.updateDocument(
        this.databaseId,
        this.notificationsCollectionId,
        notificationId,
        { isRead: true }
      );
    } catch (error) {
      console.error("Mark notification read error:", error);
    }
  }

  async markAllAsRead(userId) {
    try {
      const unread = await this.databases.listDocuments(
        this.databaseId,
        this.notificationsCollectionId,
        [
          Query.equal("userId", userId),
          Query.equal("isRead", false),
          Query.limit(100),
        ]
      );

      return await Promise.all(
        unread.documents.map((doc) =>
          this.markAsRead(doc.$id)
        )
      );
    } catch (error) {
      console.error("Mark all read error:", error);
    }
  }
}

const notificationService = new NotificationService();
export default notificationService;
