import { Client, Databases, ID, Query } from "appwrite";
import { Permission, Role } from "appwrite";

class FollowService {
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

  get followsCollectionId() {
    return import.meta.env.VITE_APPWRITE_FOLLOWS_ID || "follows";
  }



async followUser(followerId, followingId, followerName) {
  try {
    const existing = await this.isFollowing(followerId, followingId);
    if (existing) return null;

    const res = await this.databases.createDocument(
      this.databaseId,
      this.followsCollectionId,
      ID.unique(),
      {
        followerId,
        followingId,
      },
      [
        Permission.read(Role.user(followerId)),
        Permission.delete(Role.user(followerId)),
      ]
    );

    // ✅ NOTIFY TARGET USER
    import("./notification").then(({ default: notificationService }) => {
      notificationService.createNotification({
        userId: followingId,
        actorId: followerId,
        actorName: followerName,
        type: "follow",
      });
    });

    return res;
  } catch (error) {
    console.error("followUser error:", error);
    throw error;
  }
}

  async unfollowUser(followerId, followingId) {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.followsCollectionId,
        [
          Query.equal("followerId", followerId),
          Query.equal("followingId", followingId),
        ],
      );

      const docId = response?.documents?.[0]?.$id;

      if (!docId) {
        return null;
      }

      return await this.databases.deleteDocument(
        this.databaseId,
        this.followsCollectionId,
        docId,
      );
    } catch (error) {
      console.error("unfollowUser error:", error);
      throw error;
    }
  }

  async isFollowing(followerId, followingId) {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.followsCollectionId,
        [
          Query.equal("followerId", followerId),
          Query.equal("followingId", followingId),
          Query.limit(1),
        ],
      );

      return (response?.documents?.length || 0) > 0;
    } catch (error) {
      console.error("isFollowing error:", error);
      return false;
    }
  }

  async getFollowersCount(userId) {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.followsCollectionId,
        [Query.equal("followingId", userId)],
      );
      return response?.total || 0;
    } catch (error) {
      console.error("getFollowersCount error:", error);
      return 0;
    }
  }

  async getFollowingCount(userId) {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.followsCollectionId,
        [Query.equal("followerId", userId)],
      );
      return response?.total || 0;
    } catch (error) {
      console.error("getFollowingCount error:", error);
      return 0;
    }
  }

  async getFollowing(userId) {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.followsCollectionId,
        [
          Query.equal("followerId", userId),
          Query.limit(1000),
        ],
      );
      return (response?.documents || []).map((doc) => doc.followingId);
    } catch (error) {
      console.error("getFollowing error:", error);
      return [];
    }
  }

  async getFollowers(userId) {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.followsCollectionId,
        [
          Query.equal("followingId", userId),
          Query.limit(1000),
        ],
      );
      return (response?.documents || []).map((doc) => doc.followerId);
    } catch (error) {
      console.error("getFollowers error:", error);
      return [];
    }
  }
}

const followService = new FollowService();
export default followService;
