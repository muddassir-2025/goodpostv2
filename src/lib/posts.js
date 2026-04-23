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

export function sortPosts(posts = [], filter = "latest") {
  const sorted = [...posts];

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
  if (!user) {
    return posts.map((post) => {
      const safePost = normalizePost(post);

      return {
      ...safePost,
      likeCount: safePost.likeCount,
      commentCount: safePost.commentCount,
      liked: false,
      saved: false,
      favoriteId: null,
    };
    });
  }

  return Promise.all(
    posts.map(async (post) => {
      const safePost = normalizePost(post);

      try {
        const [likedRes, favoriteRes] = await Promise.all([
          likeService.getUserLike(safePost.$id, user.$id),
          favoriteService.getUserFavorite(user.$id, safePost.$id),
        ]);

        return {
          ...safePost,
          likeCount: safePost.likeCount,
          commentCount: safePost.commentCount,
          liked: likedRes?.total > 0,
          saved: favoriteRes?.total > 0,
          favoriteId: favoriteRes?.documents?.[0]?.$id || null,
        };
      } catch {
        return {
          ...safePost,
          likeCount: safePost.likeCount,
          commentCount: safePost.commentCount,
          liked: false,
          saved: false,
          favoriteId: null,
        };
      }
    }),
  );
}

export async function fetchFeedPosts(user, queries = []) {
  const response = await postService.getPosts(queries);
  return enrichPostsForUser(response?.documents || [], user);
}
