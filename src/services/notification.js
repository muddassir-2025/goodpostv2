import { api, withQueries } from "../api/client";
import { Query } from "../lib/appwriteCompat";
import { subscribe } from "../lib/realtime";

class NotificationService {
  // Notifications are created server-side now; kept for interface compatibility.
  async createNotification() {
    return null;
  }

  async getUserNotifications(userId) {
    return api.get(
      withQueries("/api/notifications", [
        Query.equal("userId", userId),
        Query.orderDesc("$createdAt"),
        Query.limit(50),
      ]),
    );
  }

  async countUnread() {
    const response = await api.get("/api/notifications/unread-count");
    return response?.total || 0;
  }

  async markAsRead(notificationId) {
    return api.patch(`/api/notifications/${notificationId}/read`, {});
  }

  async markAllAsRead() {
    return api.post("/api/notifications/read-all", {});
  }

  async deleteNotification(notificationId) {
    return api.delete(`/api/notifications/${notificationId}`);
  }

  async deleteAllNotifications() {
    return api.delete("/api/notifications");
  }

  subscribeToNotifications(userId, callback) {
    const unsubscribers = ["notification:create", "notification:update", "notification:delete"].map((type) =>
      subscribe(type, (payload) => {
        if (payload?.userId === userId || payload?.allRead || payload?.all) {
          callback(payload, type);
        }
      }),
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }
}

const notificationService = new NotificationService();
export default notificationService;
