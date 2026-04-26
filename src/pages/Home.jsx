import { useDeferredValue, useEffect, useState, useRef, useCallback } from "react";
import { Query } from "appwrite";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import EmptyState from "../components/EmptyState";
import PostCard from "../components/PostCard";
import PostSkeleton from "../components/PostSkeleton";
import StoryBar from "../components/StoryBar";
import { SearchIcon } from "../components/ui/Icons";
import postService from "../appwrite/post";
import followService from "../appwrite/follow";
import { syncFavorite, syncLike } from "../lib/engagement";
import { confirm, toast } from "../confirmService";
import { fetchFeedPosts, filterPosts, sortPosts } from "../lib/posts";
import { buildStories } from "../lib/ui";
import { motion, AnimatePresence } from "framer-motion";

const filters = [
  { id: "discovery", label: "For You" },
  { id: "following", label: "Following" },
  { id: "latest", label: "Latest" },
  { id: "likes", label: "Popular" },
];

export default function Home() {
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]); 
  const [allowedUsers, setAllowedUsers] = useState(new Set()); // ✅ NEW
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("discovery");
  const [mediaFilter, setMediaFilter] = useState("all"); // all, images, audio

  // ✅ SERVER-SIDE PAGINATION STATE
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 10;
  
  const loaderRef = useRef(null);
  const deferredSearch = useDeferredValue(search);

  const loadPosts = async (isInitial = false) => {
    if (!hasMore && !isInitial) return;
    if (loadingMore) return;

    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const queries = [
        Query.equal("isPublished", true),
        Query.limit(PAGE_SIZE),
        Query.offset(isInitial ? 0 : posts.length),
        Query.orderDesc("$createdAt"),
      ];

      if (mediaFilter === "images") queries.push(Query.isNotNull("featuredImg"));
      if (mediaFilter === "audio") queries.push(Query.isNotNull("audioId"));
      
      if (filter === "following" && user) {
        const followingIds = await followService.getFollowing(user.$id);
        if (followingIds.length > 0) {
          queries.push(Query.equal("authorID", followingIds));
        } else {
          setPosts([]);
          setHasMore(false);
          return;
        }
      }

      const data = await fetchFeedPosts(user, queries);

      if (isInitial) {
        setPosts(data);
        const followingIds = user ? await followService.getFollowing(user.$id) : [];
        const allowed = user ? new Set([user.$id, ...followingIds]) : new Set();
        const storyPosts = data.filter(p => allowed.has(p.authorID));
        setStories(buildStories(storyPosts, user).sort((a,b) => Number(b.isOwn) - Number(a.isOwn)));
        setAllowedUsers(allowed);
      } else {
        setPosts(prev => [...prev, ...data]);
      }

      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
      setError("Could not load posts.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setPosts([]);
    setHasMore(true);
    loadPosts(true);
  }, [user, filter, mediaFilter, deferredSearch]);

  // ✅ INFINITE SCROLL OBSERVER
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadPosts(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, posts.length]);

  function updatePost(postId, updater) {
    setPosts((current) =>
      current.map((post) =>
        post.$id === postId ? updater(post) : post
      )
    );
  }

  const handleLikeToggle = useCallback(async (post) => {
    if (!user) {
      navigate("/login");
      return;
    }

    const nextLiked = !post.liked;

    updatePost(post.$id, (current) => ({
      ...current,
      liked: nextLiked,
      likeCount: Math.max(
        (current.likeCount || 0) + (nextLiked ? 1 : -1),
        0
      ),
    }));

    try {
      await syncLike({
        postId: post.$id,
        userId: user.$id,
        userName: user.name,
        currentlyLiked: post.liked,
      });
    } catch {
      updatePost(post.$id, (current) => ({
        ...current,
        liked: post.liked,
        likeCount: post.likeCount || 0,
      }));
    }
  }, [user, navigate]);

  const handleFavoriteToggle = useCallback(async (post) => {
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
  }, [user, navigate]);

  async function handleDelete(post) {
    try {
      if (post.featuredImg) {
        await postService.deleteFile(post.featuredImg);
      }

      if (post.audioId) {
        await postService.deleteFile(post.audioId);
      }

      await postService.deletePost(post.$id);

      setPosts((current) =>
        current.filter((item) => item.$id !== post.$id)
      );
    } catch {
      setError("Delete failed. Please try again.");
    }
  }

  async function handleReport(postId) {
    if (!user) {
      navigate("/login");
      return;
    }

    const ok = await confirm("Report this post for inappropriate content? If 5 users report it, it will be automatically removed.");
    if (!ok) return;

    try {
      const res = await postService.reportPost(postId, user.$id);
      
      if (res.status === "deleted") {
        setPosts(prev => prev.filter(p => p.$id !== postId));
        toast("Post removed after multiple reports.", "warning");
      } else if (res.status === "already_reported") {
        toast("You have already reported this post.", "info");
      } else {
        toast("Report submitted successfully.", "success");
      }
    } catch {
      setError("Report failed. Please try again.");
    }
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[#121212]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">
          Feed
        </p>

        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-xl text-white">
            IN THE NAME OF GOD — 
            WHERE NEW HAPPINESS BEGINS.
            </h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
              Use the internet as a tool for good, not distraction. What you share will count for or against you.
            </p>
          </div>

          <Link
            to={user ? "/create" : "/login"}
            className="hidden rounded-full bg-grey-400 px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-700 sm:inline-flex"
          >
            Share
          </Link>
        </div>

        {/* SEARCH */}
        <div className="mt-5 rounded-[26px] border border-white/10 bg-black/35 p-3">
          <label className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/6 text-zinc-400">
              <SearchIcon className="h-5 w-5" />
            </span>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts, captions, or creators"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </label>
        </div>
        {/* FILTERS */}
        <div className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`relative rounded-full px-3 py-2 text-sx transition-colors whitespace-nowrap ${
                filter === item.id
                  ? "text-black font-medium"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {filter === item.id && (
                <motion.div
                  layoutId="activeFilter"
                  className="absolute inset-0 rounded-full bg-white"
                  transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
                />
              )}
              <span className="relative z-10">{item.label}</span>
            </button>
          ))}
        </div>

        {/* MEDIA FILTERS */}
        <div className="mt-4 flex gap-6 border-t border-white/5 pt-4">
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
              <span className="relative z-10">{item.label}</span>
              {mediaFilter === item.id && (
                <motion.div 
                  layoutId="activeMediaFilter"
                  className="absolute -bottom-1 left-0 h-[2px] w-full rounded-full bg-blue-500"
                  transition={{ type: "spring", duration: 0.4 }}
                />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ✅ STORIES (FIXED) */}
      <StoryBar stories={stories} />

      {/* ERROR */}
      {error && (
        <div className="rounded-[26px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* POSTS */}
      {loading ? (
        <PostSkeleton count={3} />
      ) : posts.length ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${filter}-${mediaFilter}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {posts.map((post, index) => (
              <PostCard
                key={post.$id}
                post={post}
                currentUserId={user?.$id}
                onToggleLike={handleLikeToggle}
                onToggleFavorite={handleFavoriteToggle}
                onDelete={handleDelete}
                onEdit={(id) => navigate(`/edit/${id}`)}
                onReport={handleReport}
                isPriority={index === 0}
              />
            ))}

            {/* INFINITE SCROLL LOADER */}
            {hasMore && (
              <div ref={loaderRef} className="py-6 flex justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-500 border-t-white"></div>
              </div>
            )}

            {!hasMore && posts.length > 5 && (
              <p className="py-8 text-center text-xs text-zinc-500">
                You've caught up with everything!
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <EmptyState
          eyebrow="Feed quiet"
          title="No posts match this vibe"
          description="Try another search or clear filters."
          actionLabel="Create a post"
          actionTo={user ? "/create" : "/login"}
        />
      )}
    </div>
  );
}