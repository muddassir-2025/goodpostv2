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

  async createNotification({ userId, actorId, actorName, type, postId = null, postSlug = null, content = null }) {
    if (userId === actorId) return null; // Don't notify yourself

    try {
      // ✅ CLEANUP OLD NOTIFICATIONS (Limit to 15)
      this.deleteOldNotifications(userId);

      return await this.databases.createDocument(
        this.databaseId,
        this.notificationsCollectionId,
        ID.unique(),
        {
          userId,
          actorId,
          actorName,
          type,
          postId,
          postSlug,
          content,
          isRead: false,
        },
        [
          Permission.read(Role.any()), 
          Permission.write(Role.user(userId)), // Receiver can mark as read & delete
          Permission.write(Role.user(actorId)), // Sender can delete (e.g., if they unlike)
        ]
      );
    } catch (error) {
      console.error("Create notification error:", error);
    }
  }

  async deleteOldNotifications(userId) {
    try {
      const res = await this.databases.listDocuments(
        this.databaseId,
        this.notificationsCollectionId,
        [
          Query.equal("userId", userId),
          Query.orderDesc("$createdAt"),
          Query.offset(15), // Get everything after the first 15
        ]
      );

      if (res.documents.length > 0) {
        await Promise.all(
          res.documents.map((doc) =>
            this.databases.deleteDocument(
              this.databaseId,
              this.notificationsCollectionId,
              doc.$id
            )
          )
        );
      }
    } catch (error) {
      console.error("Cleanup error:", error);
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
      // Don't log "not authorized" repeatedly to avoid console spam
      if (error?.code !== 401) {
        console.error("Get notifications error:", error);
      }
      return { documents: [] };
    }
  }

  async countUnread(userId) {
    try {
      const res = await this.databases.listDocuments(
        this.databaseId,
        this.notificationsCollectionId,
        [
          Query.equal("userId", userId),
          Query.equal("isRead", false),
          Query.limit(1),
        ]
      );
      return res?.total || 0;
    } catch (error) {
      // If permissions are not set in Appwrite console, this will fail
      // We catch it silently to prevent console spam
      return 0;
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

  async deleteNotification(notificationId) {
    try {
      return await this.databases.deleteDocument(
        this.databaseId,
        this.notificationsCollectionId,
        notificationId
      );
    } catch (error) {
      console.error("Delete notification error:", error);
    }
  }

  async deleteAllNotifications(userId) {
    try {
      const res = await this.databases.listDocuments(
        this.databaseId,
        this.notificationsCollectionId,
        [
          Query.equal("userId", userId),
          Query.limit(100),
        ]
      );

      return await Promise.all(
        res.documents.map((doc) =>
          this.databases.deleteDocument(
            this.databaseId,
            this.notificationsCollectionId,
            doc.$id
          )
        )
      );
    } catch (error) {
      console.error("Delete all notifications error:", error);
    }
  }

  // ✅ Real-time subscription
  subscribeToNotifications(userId, callback) {
    return this.client.subscribe(
      `databases.${this.databaseId}.collections.${this.notificationsCollectionId}.documents`,
      (response) => {
        if (
          response.events.includes(`databases.${this.databaseId}.collections.${this.notificationsCollectionId}.documents.*.create`) ||
          response.events.includes(`databases.${this.databaseId}.collections.${this.notificationsCollectionId}.documents.*.update`) ||
          response.events.includes(`databases.${this.databaseId}.collections.${this.notificationsCollectionId}.documents.*.delete`)
        ) {
           if (response.payload.userId === userId) {
             callback(response.payload, response.events);
           }
        }
      }
    );
  }
}

const notificationService = new NotificationService();
export default notificationService;
