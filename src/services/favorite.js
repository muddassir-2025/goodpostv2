import { api, withQueries } from "../api/client";
import { Query } from "../lib/appwriteCompat";

class FavoriteService {
  async addFavorite(userId, postId) {
    return api.post("/api/favorites", { postId });
  }

  async deleteFavorite(favId) {
    return api.delete(`/api/favorites/${favId}`);
  }

  async getUserFavorite(userId, postId) {
    return api.get(withQueries("/api/favorites", [Query.equal("userId", userId), Query.equal("postId", postId)]));
  }

  async getUSerAllFavorites(userId) {
    return api.get(withQueries("/api/favorites", [Query.equal("userId", userId)]));
  }

  // Batch helper used when enriching a feed: postId -> favorite document.
  async getFavoriteMap(userId, postIds) {
    if (!postIds?.length) return {};
    const response = await api.get(
      withQueries("/api/favorites", [Query.equal("userId", userId), Query.equal("postId", postIds)]),
    );
    const map = {};
    for (const doc of response?.documents || []) map[doc.postId] = doc.$id;
    return map;
  }
}

const favoriteService = new FavoriteService();
export default favoriteService;
