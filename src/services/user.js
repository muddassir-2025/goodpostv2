import { api } from "../api/client";

class UserService {
  /**
   * List or search profiles. An empty term returns the most recent accounts.
   * The endpoint takes a plain `search` query param rather than the Appwrite-style
   * `queries` JSON used elsewhere.
   */
  async searchUsers(term = "") {
    const query = term ? `?search=${encodeURIComponent(term)}` : "";
    return api.get(`/api/users${query}`);
  }

  async getUser(userId) {
    if (!userId) return null;
    return api.get(`/api/users/${userId}`);
  }

  async updateProfile(patch) {
    return api.patch("/api/users/me", patch);
  }
}

const userService = new UserService();
export default userService;
