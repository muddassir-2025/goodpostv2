import { api } from "../api/client";

class StoryService {
  // Only unexpired (last 24h) stories are returned by the API.
  async getStories() {
    return api.get("/api/stories");
  }

  async createStory(imageId) {
    return api.post("/api/stories", { imageId });
  }

  async deleteStory(id) {
    return api.delete(`/api/stories/${id}`);
  }
}

const storyService = new StoryService();
export default storyService;
