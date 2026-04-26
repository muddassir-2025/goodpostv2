import { Client, ID, Databases, Query, Permission, Role } from "appwrite";

class FavoriteService {
  client = new Client();
  databases;

  constructor() {
    this.client
      .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
      .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

    this.databases = new Databases(this.client);
  }

  // Add
  async addFavorite(userId, postId) {
    try {
      return await this.databases.createDocument(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_FAVORITES_ID,
        ID.unique(),
        { userId, postId },
        [
          Permission.read(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ]
      );
    } catch (error) {
      console.error("addFavorite error:", error);
      throw error;
    }
  }

  // delete
  async deleteFavorite(favId) {
    try {
      return await this.databases.deleteDocument(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_FAVORITES_ID,
        favId
      );
    } catch (error) {
      console.error("deleteFavorite error:", error);
      throw error;
    }
  }

  // check : user favorite for this post
  async getUserFavorite(userId, postId) {
    try {
      const response = await this.databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_FAVORITES_ID,
        [Query.equal("userId", userId), Query.equal("postId", postId)]
      );
      return response;
    } catch (error) {
      console.error("getUserFavorite error:", error);
      return { documents: [], total: 0 };
    }
  }

  // get all users favorites
  async getUSerAllFavorites(userId) {
    try {
      const response = await this.databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_FAVORITES_ID,
        [Query.equal("userId", userId)]
      );
      return response;
    } catch (error) {
      console.error("getUserAllFavorites error:", error);
      return { documents: [], total: 0 };
    }
  }
}

const favoriteService = new FavoriteService();
export default favoriteService;