import { useEffect, useState, useMemo } from "react";
import { Query } from "appwrite";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import EmptyState from "../components/EmptyState";
import PostSkeleton from "../components/PostSkeleton";
import favoriteService from "../appwrite/favorite";
import postService from "../appwrite/post";
import { getFileUrl, getHandle, formatCompactNumber } from "../lib/ui";
import {
  HeartIcon,
  CommentIcon,
  PlayIcon,
  ImageIcon,
  SearchIcon,
} from "../components/ui/Icons";

const PRESET_GRADIENTS = [
  "from-indigo-600 to-blue-500",
  "from-rose-500 to-orange-400",
  "from-emerald-500 to-teal-400",
  "from-blue-600 to-cyan-500",
  "from-amber-500 to-rose-500",
  "from-indigo-600 to-violet-500",
  "from-fuchsia-600 to-rose-500",
  "from-cyan-600 to-blue-500",
];

const getPostGradient = (id) => {
  const index =
    Math.abs(
      id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    ) % PRESET_GRADIENTS.length;
  return PRESET_GRADIENTS[index];
};

const FILTERS = [
  { id: "all",    label: "All"    },
  { id: "images", label: "Images" },
  { id: "audio",  label: "Audio"  },
];

export default function Favorites() {
  const user     = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();

  const [posts,       setPosts]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter,      setFilter]      = useState("all");

  useEffect(() => {
    let active = true;
    async function fetchFavorites() {
      if (!user) { setPosts([]); setLoading(false); return; }
      setLoading(true);
      try {
        const favoriteResponse = await favoriteService.getUSerAllFavorites(user.$id);
        const postIds = favoriteResponse?.documents?.map((item) => item.postId) || [];
        if (!postIds.length) { if (active) setPosts([]); return; }
        
        // Bulk fetch posts
        const res = await postService.getPosts([Query.equal("$id", postIds.slice(0, 100))]);
        if (active) setPosts(res?.documents || []);
      } catch (error) {
        console.error("Favorites load error:", error);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchFavorites();
    return () => (active = false);
  }, [user]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesSearch =
        post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.authorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter =
        filter === "all" ||
        (filter === "images" && !!post.featuredImg) ||
        (filter === "audio"  && !!post.audioId);
      return matchesSearch && matchesFilter;
    });
  }, [posts, searchQuery, filter]);

  if (!user) {
    return (
      <EmptyState
        eyebrow="Favorites"
        title="Sign in to see saved posts"
        description="Your personal collection is synced to your account."
        actionLabel="Log in"
        actionTo="/login"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">

      {/* ── HEADER ── */}
      <div className="relative overflow-hidden border-b border-white/[0.06]">
        {/* Glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-8 h-48 w-48 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)" }}
        />

        <div className="relative px-5 pt-7 pb-5">
          {/* Eyebrow + title */}
          <p className="text-[11px] uppercase tracking-widest text-white/25 mb-1.5">
            Private Collection
          </p>
          <div className="flex items-end justify-between gap-3">
            <h1 className="text-[32px] font-extrabold text-white leading-none tracking-tight">
              Saved
            </h1>
            {!loading && (
              <span className="mb-0.5 text-[13px] text-white/30">
                {filteredPosts.length}{" "}
                {filteredPosts.length === 1 ? "post" : "posts"}
              </span>
            )}
          </div>

          {/* Search */}
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-white/[0.06] border border-white/[0.08] px-4 py-2.5 transition-all duration-200 focus-within:bg-white/[0.08] focus-within:border-white/20 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]">
            <SearchIcon className="h-4 w-4 text-white/30 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved posts…"
              className="w-full bg-transparent text-[14px] text-white placeholder:text-white/25 outline-none caret-blue-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="flex-shrink-0 h-5 w-5 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors text-white/60 text-[11px] font-bold"
              >
                ×
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="mt-4 flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${
                  filter === f.id
                    ? "bg-white text-black shadow-sm"
                    : "border border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── GRID ── */}
      <div className="p-1.5 sm:p-2">
        {loading ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl bg-white/[0.05] animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        ) : filteredPosts.length ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-1.5 animate-in fade-in duration-300">
            {filteredPosts.map((post) => {
              const imageSrc = getFileUrl(post.featuredImg);
              const gradient = getPostGradient(post.$id);

              return (
                <Link
                  key={post.$id}
                  to={`/post/${post.slug}`}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-zinc-900 transition-transform duration-200 hover:scale-[0.98] hover:z-10"
                >
                  {/* Image or gradient fallback */}
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div
                      className={`flex h-full w-full items-center justify-center p-4 relative overflow-hidden group/textcard ${
                        post.audioId ? `bg-gradient-to-br ${gradient}` : "bg-zinc-800"
                      }`}
                    >
                      {/* Subtle pattern / texture overlay (text cards only) */}
                      {!post.audioId && (
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                      )}
                      
                      {/* Darker gradient bleed from the corners (text cards only) */}
                      {!post.audioId && (
                        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-30 mix-blend-soft-light`}></div>
                      )}

                      {/* BG decoration */}
                      <div className="absolute inset-0 flex items-center justify-center select-none">
                        {post.audioId ? (
                          <div className="flex items-center justify-center gap-1 w-full h-full px-4 opacity-[0.15] group-hover:opacity-[0.25] transition-opacity">
                            {[...Array(8)].map((_, i) => (
                              <div
                                key={i}
                                className="w-1 bg-white rounded-full animate-waveform"
                                style={{
                                  height: `${30 + (Math.sin(i * 1.5) * 20 + 20)}%`,
                                  animationDelay: `${i * 0.1}s`,
                                }}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] group-hover:opacity-[0.1] transition-opacity">
                            <span className="text-[120px] font-black text-white leading-none uppercase italic">
                              {post.title.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="relative z-10 flex flex-col items-center">
                         <h3 className="text-center text-[15px] sm:text-[17px] font-black text-white leading-tight line-clamp-4 tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                           {post.title}
                         </h3>
                         <div className="mt-2 h-0.5 w-6 bg-white/20 rounded-full group-hover/textcard:w-10 transition-all duration-300"></div>
                      </div>
                    </div>
                  )}

                  {/* Media type badge — top-right */}
                  {(post.audioId || post.featuredImg) && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {post.audioId ? (
                        <PlayIcon className="h-3 w-3 text-white/70 drop-shadow" />
                      ) : (
                        <ImageIcon className="h-3 w-3 text-white/70 drop-shadow" />
                      )}
                    </div>
                  )}

                  {/* Hover stats overlay */}
                  <div className="absolute inset-0 flex items-end justify-start gap-3 p-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="flex items-center gap-1 text-white">
                      <HeartIcon className="h-3.5 w-3.5 fill-current" />
                      <span className="text-[11px] font-bold">
                        {formatCompactNumber(post.likeCount || 0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-white">
                      <CommentIcon className="h-3.5 w-3.5 fill-current" />
                      <span className="text-[11px] font-bold">
                        {formatCompactNumber(post.commentCount || 0)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="pt-12 px-4">
            <EmptyState
              eyebrow="Collection"
              title={searchQuery ? `No matches for "${searchQuery}"` : "Nothing saved yet"}
              description={
                searchQuery
                  ? "Try a different keyword."
                  : "Tap the bookmark on any post to save it here."
              }
              actionLabel="Browse posts"
              actionTo="/"
            />
          </div>
        )}
      </div>
    </div>
  );
}