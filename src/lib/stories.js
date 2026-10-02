/**
 * Group flat story documents (one row per story) into one entry per author, newest
 * story first. The current user's group always comes first so "Your story" is pinned,
 * even before they have posted one.
 */
export function groupStories(documents = [], user) {
  const byUser = new Map();

  for (const story of documents) {
    if (!story?.userId) continue;
    let group = byUser.get(story.userId);
    if (!group) {
      group = {
        userId: story.userId,
        name: story.userName || "Guest",
        isOwn: story.userId === user?.$id,
        items: [],
      };
      byUser.set(story.userId, group);
    }
    group.items.push({
      id: story.$id,
      imageUrl: story.imageUrl,
      createdAt: story.$createdAt,
    });
  }

  const groups = [...byUser.values()].map((group) => ({
    ...group,
    // API returns newest first; keep that order within a group.
    items: group.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  }));

  if (user) {
    const own = byUser.get(user.$id);
    if (own) {
      return [own, ...groups.filter((group) => group.userId !== user.$id)];
    }
    return [
      { userId: user.$id, name: user.name || "You", isOwn: true, items: [] },
      ...groups,
    ];
  }

  return groups;
}
