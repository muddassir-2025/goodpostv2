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
import { ArrowLeftIcon } from "../components/ui/Icons";

export default function Feed() {
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mediaFilter, setMediaFilter] = useState("all"); // all, images, audio

  useEffect(() => {
    let active = true;

    async function loadPosts() {
      if (!user) {
        if (active) {
          setPosts([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [data, followingIds] = await Promise.all([
          fetchFeedPosts(user),
          followService.getFollowing(user.$id),
        ]);

        const followedSet = new Set(followingIds || []);
        const filtered = data.filter((post) => followedSet.has(post.authorID));
        const ordered = sortPosts(filtered, "latest").sort(
          (a, b) => Number(Boolean(b.audioId)) - Number(Boolean(a.audioId)),
        );

        if (active) {
          setPosts(ordered);
        }
      } catch {
        if (active) {
          setError("Could not load posts from people you follow.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPosts();

    return () => {
      active = false;
    };
  }, [user]);

  function updatePost(postId, updater) {
    setPosts((current) =>
      current.map((post) => (post.$id === postId ? updater(post) : post)),
    );
  }

  async function handleLikeToggle(post) {
    if (!user) {
      navigate("/login");
      return;
    }

    const nextLiked = !post.liked;

    updatePost(post.$id, (current) => ({
      ...current,
      liked: nextLiked,
      likeCount: Math.max((current.likeCount || 0) + (nextLiked ? 1 : -1), 0),
    }));

    try {
      await syncLike({
        postId: post.$id,
        userId: user.$id,
        currentlyLiked: post.liked,
      });
    } catch {
      updatePost(post.$id, (current) => ({
        ...current,
        liked: post.liked,
        likeCount: post.likeCount || 0,
      }));
    }
  }

  async function handleFavoriteToggle(post) {
    if (!user) {
      navigate("/login");
      return;
    }

    const nextSaved = !post.saved;

    updatePost(post.$id, (current) => ({
      ...current,
      saved: nextSaved,
      favoriteId: nextSaved ? current.favoriteId : null,
    }));

    try {
      const result = await syncFavorite({
        postId: post.$id,
        userId: user.$id,
        currentlySaved: post.saved,
        favoriteId: post.favoriteId,
      });

      updatePost(post.$id, (current) => ({
        ...current,
        saved: result.saved,
        favoriteId: result.favoriteId,
      }));
    } catch {
      updatePost(post.$id, (current) => ({
        ...current,
        saved: post.saved,
        favoriteId: post.favoriteId || null,
      }));
    }
  }

  async function handleDelete(post) {
    if (!window.confirm("Delete this post?")) {
      return;
    }

    try {
      if (post.featuredImg) {
        await postService.deleteFile(post.featuredImg);
      }

      if (post.audioId) {
        await postService.deleteFile(post.audioId);
      }

      await postService.deletePost(post.$id);

      setPosts((current) => current.filter((item) => item.$id !== post.$id));
    } catch {
      setError("Delete failed. Please try again.");
    }
  }

  async function handleReport(postId) {
    if (!user) {
      navigate("/login");
      return;
    }

    const ok = await window.confirm("Report this post for inappropriate content? If 5 users report it, it will be automatically removed.");
    if (!ok) return;

    try {
      const res = await postService.reportPost(postId, user.$id);
      
      if (res.status === "deleted") {
        setPosts(prev => prev.filter(p => p.$id !== postId));
        alert("Post removed after multiple reports.");
      } else if (res.status === "already_reported") {
        alert("You have already reported this post.");
      } else {
        alert("Report submitted successfully.");
      }
    } catch {
      setError("Report failed. Please try again.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[32px] border border-white/10 bg-[#121212]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 transition"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Feed</p>
        </div>
        <h1 className="font-display text-3xl text-white">From people you follow</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          See posts only from creators you already follow.
        </p>

        {/* MEDIA FILTERS */}
        <div className="mt-6 flex gap-6 border-t border-white/5 pt-4">
          {[
            { id: "all", label: "All" },
            { id: "images", label: "Images" },
            { id: "audio", label: "Audio" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setMediaFilter(item.id)}
              className={`text-xs font-bold uppercase tracking-widest transition relative ${
                mediaFilter === item.id ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {item.label}
              {mediaFilter === item.id && (
                <div className="absolute -bottom-1 left-0 h-[2px] w-full rounded-full bg-blue-500 animate-in fade-in zoom-in duration-300" />
              )}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <div className="rounded-[26px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <PostSkeleton count={2} />
      ) : (
        <div className="space-y-4">
          {posts
            .filter((p) => {
              if (mediaFilter === "images") return !!p.featuredImg;
              if (mediaFilter === "audio") return !!p.audioId;
              return true;
            })
            .map((post) => (
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
            
          {posts.filter((p) => {
            if (mediaFilter === "images") return !!p.featuredImg;
            if (mediaFilter === "audio") return !!p.audioId;
            return true;
          }).length === 0 && (
            <EmptyState
              eyebrow="Feed"
              title={`No ${mediaFilter} found`}
              description={`None of the people you follow have posted ${mediaFilter === 'all' ? 'anything' : mediaFilter} yet.`}
              actionLabel="Discover more"
              actionTo="/"
            />
          )}
        </div>
      )}
    </div>
  );
}
