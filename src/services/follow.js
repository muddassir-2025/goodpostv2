import { api } from "../api/client";

class FollowService {
  async followUser(followerId, followingId, followerName) {
    return api.post("/api/follows", { followingId, followerName });
  }

  async unfollowUser(followerId, followingId) {
    return api.delete(`/api/follows?followingId=${encodeURIComponent(followingId)}`);
  }

  async isFollowing(followerId, followingId) {
    const response = await api.get(`/api/follows/status?followingId=${encodeURIComponent(followingId)}`);
    return Boolean(response?.following);
  }

  async getFollowersCount(userId) {
    const response = await api.get(`/api/follows/count?userId=${encodeURIComponent(userId)}&type=followers`);
    return response?.total || 0;
  }

  async getFollowingCount(userId) {
    const response = await api.get(`/api/follows/count?userId=${encodeURIComponent(userId)}&type=following`);
    return response?.total || 0;
  }

  async getFollowing(userId) {
    const response = await api.get(`/api/follows/following?userId=${encodeURIComponent(userId)}`);
    return response?.ids || [];
  }

  async getFollowers(userId) {
    const response = await api.get(`/api/follows/followers?userId=${encodeURIComponent(userId)}`);
    return response?.ids || [];
  }
}

const followService = new FollowService();
export default followService;
