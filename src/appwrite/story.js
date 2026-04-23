import { Client, Databases, Query } from "appwrite";

class StoryService {
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

  get collectionId() {
    return import.meta.env.VITE_APPWRITE_STORIES_ID || "stories";
  }

  async getStories() {
    const res = await this.databases.listDocuments(
      this.databaseId,
      this.collectionId,
      [
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ]
    );

    return res.documents.map((doc) => ({
      id: doc.$id,
      userId: doc.userId, // 🔥 REQUIRED
      name: doc.userName,
      cover: doc.imageUrl,
      label: doc.userName,
      href: `/story/${doc.userId}`,
    }));
  }
}

const storyService = new StoryService();
export default storyService;