import { useDeferredValue, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import EmptyState from "../components/EmptyState";
import PostCard from "../components/PostCard";
import PostSkeleton from "../components/PostSkeleton";
import StoryBar from "../components/StoryBar";
import { SearchIcon } from "../components/ui/Icons";
import postService from "../appwrite/post";
import { syncFavorite, syncLike } from "../lib/engagement";
import { fetchFeedPosts, filterPosts, sortPosts } from "../lib/posts";
import { buildStories } from "../lib/ui";

const filters = [
  { id: "latest", label: "Latest" },
  { id: "likes", label: "Popular" },
  { id: "comments", label: "Discussed" },
];

export default function Home() {
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("latest");

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let active = true;

    async function loadFeed() {
      setLoading(true);
      setError("");

      try {
        const data = await fetchFeedPosts(user);
        if (active) {
          setPosts(data);
        }
      } catch {
        if (active) {
          setError("Could not load the feed right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadFeed();
    return () => {
      active = false;
    };
  }, [user]);

  const visiblePosts = sortPosts(filterPosts(posts, deferredSearch), filter);
  const stories = buildStories(posts, user);

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

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-\[32px] border border-white/10 bg-[#121212]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Feed</p>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-white">For you</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
              A focused feed for photos, captions, and audio drops with a clean
              Instagram-style rhythm.
            </p>
          </div>

          <Link
            to={user ? "/create" : "/login"}
            className="hidden rounded-full bg-grey-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-700 sm:inline-flex"
          >
            Share
          </Link>
        </div>

        <div className="mt-5 rounded-[26px] border border-white/10 bg-black/35 p-3">
          <label className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/6 text-zinc-400">
              <SearchIcon className="h-5 w-5" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search posts, captions, or creators"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </label>
        </div>

        <div className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                filter === item.id
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <StoryBar stories={stories} />

      {error ? (
        <div className="rounded-[26px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <PostSkeleton count={3} />
      ) : visiblePosts.length ? (
        <div className="space-y-4">
          {visiblePosts.map((post) => (
            <PostCard
              key={post.$id}
              post={post}
              currentUserId={user?.$id}
              onToggleLike={handleLikeToggle}
              onToggleFavorite={handleFavoriteToggle}
              onDelete={handleDelete}
              onEdit={(postId) => navigate(`/edit/${postId}`)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          eyebrow="Feed quiet"
          title="No posts match this vibe"
          description="Try a different search term or clear the filters to see everything again."
          actionLabel="Create a post"
          actionTo={user ? "/create" : "/login"}
        />
      )}
    </div>
  );
}
