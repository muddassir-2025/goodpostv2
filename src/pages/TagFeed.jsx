import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

import PostCard from "../components/PostCard";
import PostSkeleton from "../components/PostSkeleton";
import EmptyState from "../components/EmptyState";

import { fetchFeedPosts } from "../lib/posts";

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
          post.tags?.includes(tag)
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

  // ✅ LIKE (dummy logic - replace with Appwrite later)
  const handleToggleLike = (post) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.$id === post.$id
          ? {
              ...p,
              liked: !p.liked,
              likeCount: p.liked
                ? (p.likeCount || 1) - 1
                : (p.likeCount || 0) + 1,
            }
          : p
      )
    );
  };

  // ✅ SAVE / FAVORITE
  const handleToggleFavorite = (post) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.$id === post.$id
          ? { ...p, saved: !p.saved }
          : p
      )
    );
  };

  // ✅ DELETE
  const handleDelete = (post) => {
    setPosts((prev) => prev.filter((p) => p.$id !== post.$id));
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