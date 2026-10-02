import { api, withQueries } from "../api/client";
import { Query } from "../lib/appwriteCompat";

class LikeService {
  async createLike({ postId, userName }) {
    return api.post("/api/likes", { postId, userName });
  }

  async deleteLike(likeId) {
    return api.delete(`/api/likes/${likeId}`);
  }

  async getUserLike(postId, userId) {
    return api.get(withQueries("/api/likes", [Query.equal("postId", postId), Query.equal("userId", userId)]));
  }

  async countLikes(postId) {
    return api.get(`/api/likes/count?postId=${encodeURIComponent(postId)}`);
  }

  // Batch helper used when enriching a feed: which of these posts has the user liked?
  async getLikedPostIds(userId, postIds) {
    if (!postIds?.length) return new Set();
    const response = await api.get(
      withQueries("/api/likes", [Query.equal("userId", userId), Query.equal("postId", postIds)]),
    );
    return new Set((response?.documents || []).map((doc) => doc.postId));
  }
}

const likeService = new LikeService();
export default likeService;
