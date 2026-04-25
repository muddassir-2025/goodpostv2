import { useEffect, useState } from "react";
import { Query } from "appwrite";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

import PostCard from "../components/PostCard";
import PostSkeleton from "../components/PostSkeleton";
import EmptyState from "../components/EmptyState";

import { fetchFeedPosts, sortPosts } from "../lib/posts";
import { syncFavorite, syncLike } from "../lib/engagement";
import postService from "../appwrite/post";
import { confirm, toast } from "../confirmService";

const FILTERS = [
  { id: "latest", label: "Latest" },
  { id: "likes", label: "Popular" },
  { id: "comments", label: "Discussed" },
];

export default function TagFeed() {
  const { tag } = useParams();
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("latest");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchFeedPosts(user, [
          Query.contains("tags", [tag])
        ]);
        if (active) setPosts(data);
      } catch (err) {
        console.log("Tag feed error:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [tag, user]);

  /* ── LIKE ── */
  const handleToggleLike = async (post) => {
    if (!user) { navigate("/login"); return; }
    const nextLiked = !post.liked;
    setPosts((prev) =>
      prev.map((p) =>
        p.$id === post.$id
          ? { ...p, liked: nextLiked, likeCount: Math.max((p.likeCount || 0) + (nextLiked ? 1 : -1), 0) }
          : p
      )
    );
    try {
      await syncLike({ postId: post.$id, userId: user.$id, currentlyLiked: post.liked });
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.$id === post.$id ? { ...p, liked: post.liked, likeCount: post.likeCount || 0 } : p
        )
      );
    }
  };

  /* ── SAVE ── */
  const handleToggleFavorite = async (post) => {
    if (!user) { navigate("/login"); return; }
    const nextSaved = !post.saved;
    setPosts((prev) =>
      prev.map((p) =>
        p.$id === post.$id ? { ...p, saved: nextSaved, favoriteId: nextSaved ? p.favoriteId : null } : p
      )
    );
    try {
      const result = await syncFavorite({ postId: post.$id, userId: user.$id, currentlySaved: post.saved, favoriteId: post.favoriteId });
      setPosts((prev) =>
        prev.map((p) => p.$id === post.$id ? { ...p, saved: result.saved, favoriteId: result.favoriteId } : p)
      );
    } catch {
      setPosts((prev) =>
        prev.map((p) => p.$id === post.$id ? { ...p, saved: post.saved, favoriteId: p.favoriteId || null } : p)
      );
    }
  };

  /* ── DELETE ── */
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

  /* ── REPORT ── */
  const handleReport = async (postId) => {
    if (!user) { navigate("/login"); return; }
    const ok = await confirm("Report this post? If 5 users report it, it will be automatically removed.");
    if (!ok) return;
    try {
      const res = await postService.reportPost(postId, user.$id);
      if (res.status === "deleted") {
        setPosts((prev) => prev.filter((p) => p.$id !== postId));
        toast("Post removed after multiple reports.", "warning");
      } else if (res.status === "already_reported") {
        toast("Already reported.", "info");
      } else {
        toast("Report submitted.", "success");
      }
    } catch (err) {
      console.error("Report failed:", err);
    }
  };

  const visiblePosts = sortPosts(posts, filter);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">

      {/* ── HEADER ── */}
      <div className="relative overflow-hidden border-b border-white/[0.06]">

        {/* Subtle radial glow behind the tag name */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)" }}
        />

        <div className="relative px-5 pt-8 pb-5">
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-1.5 text-[13px] text-white/35 hover:text-white/70 transition-colors"
          >
            <span className="text-base leading-none">←</span>
            Back
          </button>

          {/* Tag label */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-white/25 mb-1.5">
                Topic
              </p>
              <h1 className="text-[32px] font-extrabold text-white leading-none tracking-tight">
                #{tag}
              </h1>
              {!loading && (
                <p className="mt-2 text-[13px] text-white/35">
                  {visiblePosts.length}{" "}
                  {visiblePosts.length === 1 ? "post" : "posts"}
                </p>
              )}
            </div>

            {/* Decorative tag badge */}

            <div className="flex-shrink-0 px-1.5 py-[2px] rounded-full border border-white/[0.06] bg-white/[0.03] text-[9px] text-white/25">
              #{tag}
            </div>

          </div>

          {/* Filter pills */}
          <div className="mt-5 flex gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${filter === item.id
                    ? "bg-white text-black shadow-sm"
                    : "border border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08]"
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="py-4">
        {loading ? (
          <div className="px-4">
            <PostSkeleton count={3} />
          </div>
        ) : visiblePosts.length ? (
          <div className="space-y-3 px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {visiblePosts.map((post) => (
              <PostCard
                key={post.$id}
                post={post}
                currentUserId={user?.$id}
                onEdit={(id) => navigate(`/edit/${id}`)}
                onToggleLike={handleToggleLike}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDelete}
                onReport={handleReport}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 pt-8">
            <EmptyState
              title={`Nothing tagged #${tag} yet`}
              description="Be the first to post under this topic."
              actionLabel="Browse topics"
              actionTo="/search"
            />
          </div>
        )}
      </div>
    </div>
  );
}