import { Client, Databases, ID, Query } from "appwrite";

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

  async followUser(followerId, followingId) {
    try {
      return await this.databases.createDocument(
        this.databaseId,
        this.followsCollectionId,
        ID.unique(),
        {
          followerId,
          followingId,
        },
      );
    } catch (error) {
      if (error?.code === 409) {
        return null;
      }

      throw error;
    }
  }

  async unfollowUser(followerId, followingId) {
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

    return this.databases.deleteDocument(
      this.databaseId,
      this.followsCollectionId,
      docId,
    );
  }

  async isFollowing(followerId, followingId) {
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
  }

  async getFollowersCount(userId) {
    const response = await this.databases.listDocuments(
      this.databaseId,
      this.followsCollectionId,
      [Query.equal("followingId", userId)],
    );

    return response?.total || 0;
  }

  async getFollowingCount(userId) {
    const response = await this.databases.listDocuments(
      this.databaseId,
      this.followsCollectionId,
      [Query.equal("followerId", userId)],
    );

    return response?.total || 0;
  }

  async getFollowing(userId) {
    const response = await this.databases.listDocuments(
      this.databaseId,
      this.followsCollectionId,
      [Query.equal("followerId", userId)],
    );

    return (response?.documents || []).map((doc) => doc.followingId);
  }

  async getFollowers(userId) {
    const response = await this.databases.listDocuments(
      this.databaseId,
      this.followsCollectionId,
      [Query.equal("followingId", userId)],
    );

    return (response?.documents || []).map((doc) => doc.followerId);
  }
}

const followService = new FollowService();
export default followService;
