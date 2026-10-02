import { api, withQueries } from "../api/client";
import { Query } from "../lib/appwriteCompat";

class CommentService {
  async createComment({ postId, userId, userName, content, parentId = null }) {
    return api.post("/api/comments", { postId, userId, userName, content, parentId });
  }

  async getComments(postId) {
    const response = await api.get(withQueries("/api/comments", [Query.equal("postId", postId)]));
    return response?.documents || [];
  }

  async updateComment(commentId, data) {
    return api.patch(`/api/comments/${commentId}`, data);
  }

  async deleteComment(commentId) {
    return api.delete(`/api/comments/${commentId}`);
  }
}

const commentService = new CommentService();
export default commentService;
