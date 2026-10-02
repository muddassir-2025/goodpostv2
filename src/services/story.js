import { api } from "../api/client";

class StoryService {
  async getStories() {
    const response = await api.get("/api/stories");
    return (response?.documents || []).map((doc) => ({
      id: doc.$id,
      userId: doc.userId,
      name: doc.userName,
      cover: doc.imageUrl,
      label: doc.userName,
      href: `/story/${doc.userId}`,
    }));
  }
}

const storyService = new StoryService();
export default storyService;
