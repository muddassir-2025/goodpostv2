import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import EmptyState from "../components/EmptyState";
import PostCard from "../components/PostCard";
import PostSkeleton from "../components/PostSkeleton";
import followService from "../appwrite/follow";
import postService from "../appwrite/post";
import { syncFavorite, syncLike } from "../lib/engagement";
import { fetchFeedPosts, sortPosts } from "../lib/posts";
import { Query } from "appwrite";

const FILTERS = [
  { id: "all",    label: "All"    },
  { id: "images", label: "Images" },
  { id: "audio",  label: "Audio"  },
];

export default function Feed() {
  const user     = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();

  const [posts,       setPosts]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [mediaFilter, setMediaFilter] = useState("all");

  useEffect(() => {
    let active = true;
    async function loadPosts() {
      if (!user) { if (active) { setPosts([]); setLoading(false); } return; }
      setLoading(true);
      setError("");
      try {
        const [data, followingIds] = await Promise.all([
          fetchFeedPosts(user, [Query.equal("isPublished", true)]),
          followService.getFollowing(user.$id),
        ]);
        const followedSet = new Set(followingIds || []);
        const filtered    = data.filter((post) => followedSet.has(post.authorID));
        const ordered     = sortPosts(filtered, "latest").sort(
          (a, b) => Number(Boolean(b.audioId)) - Number(Boolean(a.audioId))
        );
        if (active) setPosts(ordered);
      } catch {
        if (active) setError("Could not load posts from people you follow.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadPosts();
    return () => { active = false; };
  }, [user]);

  function updatePost(postId, updater) {
    setPosts((current) =>
      current.map((post) => (post.$id === postId ? updater(post) : post))
    );
  }

  async function handleLikeToggle(post) {
    if (!user) { navigate("/login"); return; }
    const nextLiked = !post.liked;
    updatePost(post.$id, (cur) => ({ ...cur, liked: nextLiked, likeCount: Math.max((cur.likeCount || 0) + (nextLiked ? 1 : -1), 0) }));
    try {
      await syncLike({ postId: post.$id, userId: user.$id, currentlyLiked: post.liked });
    } catch {
      updatePost(post.$id, (cur) => ({ ...cur, liked: post.liked, likeCount: post.likeCount || 0 }));
    }
  }

  async function handleFavoriteToggle(post) {
    if (!user) { navigate("/login"); return; }
    const nextSaved = !post.saved;
    updatePost(post.$id, (cur) => ({ ...cur, saved: nextSaved, favoriteId: nextSaved ? cur.favoriteId : null }));
    try {
      const result = await syncFavorite({ postId: post.$id, userId: user.$id, currentlySaved: post.saved, favoriteId: post.favoriteId });
      updatePost(post.$id, (cur) => ({ ...cur, saved: result.saved, favoriteId: result.favoriteId }));
    } catch {
      updatePost(post.$id, (cur) => ({ ...cur, saved: post.saved, favoriteId: post.favoriteId || null }));
    }
  }

  async function handleDelete(post) {
    if (!window.confirm("Delete this post?")) return;
    try {
      if (post.featuredImg) await postService.deleteFile(post.featuredImg);
      if (post.audioId)     await postService.deleteFile(post.audioId);
      await postService.deletePost(post.$id);
      setPosts((cur) => cur.filter((item) => item.$id !== post.$id));
    } catch {
      setError("Delete failed. Please try again.");
    }
  }

  async function handleReport(postId) {
    if (!user) { navigate("/login"); return; }
    const ok = await window.confirm("Report this post for inappropriate content? If 5 users report it, it will be automatically removed.");
    if (!ok) return;
    try {
      const res = await postService.reportPost(postId, user.$id);
      if      (res.status === "deleted")          { setPosts((prev) => prev.filter((p) => p.$id !== postId)); alert("Post removed after multiple reports."); }
      else if (res.status === "already_reported") { alert("You have already reported this post."); }
      else                                        { alert("Report submitted successfully."); }
    } catch {
      setError("Report failed. Please try again.");
    }
  }

  const visiblePosts = posts.filter((p) => {
    if (mediaFilter === "images") return !!p.featuredImg;
    if (mediaFilter === "audio")  return !!p.audioId;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">

      {/* ── HEADER ── */}
      <div className="relative overflow-hidden border-b border-white/[0.06]">

        {/* Glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 right-8 h-48 w-48 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)" }}
        />

        <div className="relative px-5 pt-7 pb-5">
          <p className="text-[11px] uppercase tracking-widest text-white/25 mb-1.5">
            Feed
          </p>
          <h1 className="text-[26px] font-extrabold text-white leading-tight">
            From people you follow
          </h1>
          <p className="mt-1.5 text-[13px] text-white/35 leading-relaxed">
            Posts from creators you've chosen to follow.
          </p>

          {/* Filter pills */}
          <div className="mt-5 flex gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setMediaFilter(item.id)}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${
                  mediaFilter === item.id
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

      {/* ── ERROR BANNER ── */}
      {error && (
        <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-400" />
          <p className="text-[13px] text-rose-300">{error}</p>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div className="py-4 px-4 space-y-3">
        {loading ? (
          <PostSkeleton count={3} />
        ) : visiblePosts.length ? (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {visiblePosts.map((post) => (
              <PostCard
                key={post.$id}
                post={post}
                currentUserId={user?.$id}
                onToggleLike={handleLikeToggle}
                onToggleFavorite={handleFavoriteToggle}
                onDelete={handleDelete}
                onEdit={(postId) => navigate(`/edit/${postId}`)}
                onReport={handleReport}
              />
            ))}
          </div>
        ) : (
          <div className="pt-8">
            <EmptyState
              eyebrow="Feed"
              title={
                mediaFilter !== "all"
                  ? `No ${mediaFilter} posts`
                  : posts.length === 0
                  ? "Your feed is empty"
                  : `No ${mediaFilter} posts`
              }
              description={
                posts.length === 0
                  ? "Follow some creators to see their posts here."
                  : `None of the people you follow have posted ${mediaFilter} yet.`
              }
              actionLabel={posts.length === 0 ? "Discover creators" : undefined}
              actionTo={posts.length === 0 ? "/search" : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}