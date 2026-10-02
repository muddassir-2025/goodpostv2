import favoriteService from "../services/favorite";
import likeService from "../services/like";

export async function syncLike({ postId, userId, userName, currentlyLiked }) {
  if (currentlyLiked) {
    const existing = await likeService.getUserLike(postId, userId);
    const likeId = existing?.documents?.[0]?.$id;

    if (likeId) {
      await likeService.deleteLike(likeId, postId);
    }

    return { liked: false };
  }

  await likeService.createLike({ postId, userId, userName });
  return { liked: true };
}

export async function syncFavorite({
  postId,
  userId,
  currentlySaved,
  favoriteId,
}) {
  if (currentlySaved) {
    let resolvedFavoriteId = favoriteId;

    if (!resolvedFavoriteId) {
      const existing = await favoriteService.getUserFavorite(userId, postId);
      resolvedFavoriteId = existing?.documents?.[0]?.$id || null;
    }

    if (resolvedFavoriteId) {
      await favoriteService.deleteFavorite(resolvedFavoriteId);
    }

    return { saved: false, favoriteId: null };
  }

  const created = await favoriteService.addFavorite(userId, postId);
  return { saved: true, favoriteId: created?.$id || null };
}
