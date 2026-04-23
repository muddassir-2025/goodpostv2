import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

import PostCard from "../components/PostCard";
import PostSkeleton from "../components/PostSkeleton";
import EmptyState from "../components/EmptyState";

import { fetchFeedPosts } from "../lib/posts";
import { syncFavorite, syncLike } from "../lib/engagement";
import postService from "../appwrite/post";

export default function TagFeed() {
  const { tag } = useParams();
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const data = await fetchFeedPosts(user);

        const filtered = data.filter((post) =>
          post.tags?.some((t) => t.toLowerCase() === tag.toLowerCase())
        );

        if (active) {
          setPosts(filtered);
        }
      } catch (err) {
        console.log("Tag feed error:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [tag, user]);

  // ✅ LIKE
  const handleToggleLike = async (post) => {
    if (!user) {
      navigate("/login");
      return;
    }

    const nextLiked = !post.liked;

    setPosts((prev) =>
      prev.map((p) =>
        p.$id === post.$id
          ? {
              ...p,
              liked: nextLiked,
              likeCount: Math.max((p.likeCount || 0) + (nextLiked ? 1 : -1), 0),
            }
          : p
      )
    );

    try {
      await syncLike({
        postId: post.$id,
        userId: user.$id,
        currentlyLiked: post.liked,
      });
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.$id === post.$id
            ? { ...p, liked: post.liked, likeCount: post.likeCount || 0 }
            : p
        )
      );
    }
  };

  // ✅ SAVE / FAVORITE
  const handleToggleFavorite = async (post) => {
    if (!user) {
      navigate("/login");
      return;
    }

    const nextSaved = !post.saved;

    setPosts((prev) =>
      prev.map((p) =>
        p.$id === post.$id
          ? { ...p, saved: nextSaved, favoriteId: nextSaved ? p.favoriteId : null }
          : p
      )
    );

    try {
      const result = await syncFavorite({
        postId: post.$id,
        userId: user.$id,
        currentlySaved: post.saved,
        favoriteId: post.favoriteId,
      });

      setPosts((prev) =>
        prev.map((p) =>
          p.$id === post.$id
            ? { ...p, saved: result.saved, favoriteId: result.favoriteId }
            : p
        )
      );
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.$id === post.$id
            ? { ...p, saved: post.saved, favoriteId: p.favoriteId || null }
            : p
        )
      );
    }
  };

  // ✅ DELETE
  const handleDelete = async (post) => {
    try {
      if (post.featuredImg) await postService.deleteFile(post.featuredImg);
      if (post.audioId) await postService.deleteFile(post.audioId);
      await postService.deletePost(post.$id);

      setPosts((prev) => prev.filter((p) => p.$id !== post.$id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="space-y-4">

      {/* HEADER */}
      <section className="rounded-[28px] border border-white/10 bg-[#121212]/90 p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Tag
        </p>
        <h1 className="font-display text-3xl text-white">
          #{tag}
        </h1>
        <p className="text-sm text-zinc-400 mt-2">
          Posts under {tag}
        </p>
      </section>

      {/* CONTENT */}
      {loading ? (
        <PostSkeleton count={3} />
      ) : posts.length ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.$id}
              post={post}
              currentUserId={user?.$id}
              onEdit={(id) => navigate(`/edit/${id}`)}
              onToggleLike={handleToggleLike}
              onToggleFavorite={handleToggleFavorite}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No posts found"
          description={`No posts exist under ${tag} yet.`}
          actionLabel="Back"
          actionTo="/search"
        />
      )}
    </div>
  );
}