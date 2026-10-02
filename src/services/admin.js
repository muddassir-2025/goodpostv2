import { api } from "../api/client";

class AdminService {
  getStats() {
    return api.get("/api/admin/stats");
  }

  getUsers({ search = "", limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set("search", search);
    return api.get(`/api/admin/users?${params.toString()}`);
  }

  setAdmin(userId, isAdmin) {
    return api.patch(`/api/admin/users/${userId}`, { isAdmin });
  }

  getReportedPosts() {
    return api.get("/api/admin/posts/reported");
  }
}

const adminService = new AdminService();
export default adminService;
