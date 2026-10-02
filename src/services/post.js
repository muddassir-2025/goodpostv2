import { api, withQueries, API_URL } from "../api/client";

const STORAGE_BASE = (import.meta.env.VITE_STORAGE_PUBLIC_URL || "").replace(/\/+$/, "");

class PostService {
  async createPost(data) {
    return api.post("/api/posts", data);
  }

  async getPosts(queries = []) {
    return api.get(withQueries("/api/posts", queries));
  }

  async getPost(slug) {
    return api.get(`/api/posts/slug/${encodeURIComponent(slug)}`);
  }

  async getPostBySearch(search = "") {
    return api.get(`/api/posts/search?search=${encodeURIComponent(search)}`);
  }

  async getPostById(id) {
    return api.get(`/api/posts/${id}`);
  }

  async updatePost(postId, data) {
    return api.patch(`/api/posts/${postId}`, data);
  }

  async deletePost(postId) {
    return api.delete(`/api/posts/${postId}`);
  }

  async reportPost(postId) {
    return api.post(`/api/posts/${postId}/report`, {});
  }

  async uploadImage(file) {
    const form = new FormData();
    form.append("file", file);
    return api.upload("/api/uploads/image", form);
  }

  async uploadAudio(file) {
    const form = new FormData();
    form.append("file", file);
    return api.upload("/api/uploads/audio", form);
  }

  async deleteFile(fileKey) {
    if (!fileKey) return null;
    return api.post("/api/uploads/delete", { key: fileKey });
  }

  // Public object URL for a stored key (Neon Object Storage, public_read bucket).
  getFileView(fileKey) {
    if (!fileKey) return "";
    if (!STORAGE_BASE) return `${API_URL}/api/uploads/${fileKey}`;
    return `${STORAGE_BASE}/${fileKey}`;
  }
}

const postService = new PostService();
export default postService;
