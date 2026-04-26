import { Query } from "appwrite";
import favoriteService from "../appwrite/favorite";
import likeService from "../appwrite/like";
import postService from "../appwrite/post";
import { normalizeText } from "./ui";

export function normalizePost(post = {}) {
  return {
    ...post,
    title: normalizeText(post.title, "Untitled post"),
    content: normalizeText(post.content, ""),
    authorName: normalizeText(post.authorName, "Guest"),
    slug: normalizeText(post.slug, ""),
    likeCount: Number.isFinite(Number(post.likeCount)) ? Number(post.likeCount) : 0,
    commentCount: Number.isFinite(Number(post.commentCount)) ? Number(post.commentCount) : 0,
  };
}

export function filterPosts(posts = [], query = "") {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return posts;
  }

  return posts.filter((post) =>
    [post.title, post.content, post.authorName].some((value) =>
      value?.toLowerCase().includes(needle),
    ),
  );
}

export function rankPostsForYou(posts = []) {
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  return [...posts]
    .map((post) => {
      const ageMs = now - new Date(post.$createdAt).getTime();
      const ageInDays = ageMs / ONE_DAY_MS;

      // 1. Freshness Score (100 points max, decays over 7 days)
      const freshness = Math.max(0, 100 - ageInDays * 15);

      // 2. Engagement Score (Likes + Comments weight)
      const engagement = (post.likeCount || 0) * 5 + (post.commentCount || 0) * 8;

      // 3. Audio Bonus (15 points for having audio)
      const audioBonus = post.audioId ? 15 : 0;

      // 4. Random Factor (0-40 points) - Reduces echo chambers
      const randomness = Math.random() * 40;

      const score = freshness + engagement + audioBonus + randomness;

      return { ...post, _algoScore: score };
    })
    .sort((a, b) => b._algoScore - a._algoScore);
}

export function sortPosts(posts = [], filter = "latest") {
  const sorted = [...posts];

  if (filter === "discovery") {
    return rankPostsForYou(sorted);
  }

  if (filter === "likes") {
    return sorted.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  }

  if (filter === "comments") {
    return sorted.sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0));
  }

  return sorted.sort(
    (a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime(),
  );
}

export async function enrichPostsForUser(posts = [], user) {
  if (!user || posts.length === 0) {
    return posts.map((post) => ({
      ...normalizePost(post),
      liked: false,
      saved: false,
      favoriteId: null,
    }));
  }

  try {
    const postIds = posts.map(p => p.$id);
    
    // Batch fetch all likes and favorites for these posts for this user
    const [likesRes, favoritesRes] = await Promise.all([
      likeService.databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_LIKES_ID,
        [Query.equal("userId", user.$id), Query.equal("postId", postIds)]
      ),
      favoriteService.databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_FAVORITES_ID,
        [Query.equal("userId", user.$id), Query.equal("postId", postIds)]
      )
    ]);

    const likedPostIds = new Set(likesRes.documents.map(d => d.postId));
    const favoriteMap = {};
    favoritesRes.documents.forEach(d => {
      favoriteMap[d.postId] = d.$id;
    });

    return posts.map((post) => {
      const safePost = normalizePost(post);
      return {
        ...safePost,
        liked: likedPostIds.has(safePost.$id),
        saved: !!favoriteMap[safePost.$id],
        favoriteId: favoriteMap[safePost.$id] || null,
      };
    });
  } catch (error) {
    console.error("Enrichment error:", error);
    return posts.map(p => ({ ...normalizePost(p), liked: false, saved: false, favoriteId: null }));
  }
}

export async function fetchFeedPosts(user, queries = []) {
  const response = await postService.getPosts(queries);
  return enrichPostsForUser(response?.documents || [], user);
}
