import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../features/auth/authSlice";
import authService from "../appwrite/auth";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import PostSkeleton from "../components/PostSkeleton";
import favoriteService from "../appwrite/favorite";
import { fetchFeedPosts } from "../lib/posts";
import { formatCompactNumber, getFileUrl, getHandle } from "../lib/ui";
import followService from "../appwrite/follow";
import {
  HeartIcon,
  CommentIcon,
  PlayIcon,
  ImageIcon,
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

const getPostGradient = (id) =>
  PRESET_GRADIENTS[
    Math.abs(
      id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    ) % PRESET_GRADIENTS.length
  ];

const FILTERS = [
  { id: "all",    label: "All"    },
  { id: "images", label: "Images" },
  { id: "audio",  label: "Audio"  },
];

/* ── Stat block ── */
function Stat({ label, value }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-0.5 py-1">
      <span className="text-[18px] font-extrabold text-white leading-none">
        {formatCompactNumber(value)}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-white/30">
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="w-px self-stretch bg-white/[0.07]" />;
}

export default function Profile() {
  const currentUser = useSelector((state) => state.auth.userData);
  const dispatch = useDispatch();
  const { id }      = useParams();
  const isOwnProfile = !id || id === currentUser?.$id;

  const [posts,          setPosts]          = useState([]);
  const [savedCount,     setSavedCount]     = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [filter,         setFilter]         = useState("all");
  const [isFollowing,    setIsFollowing]    = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loadingFollow,  setLoadingFollow]  = useState(false);

  /* ── follow data ── */
  useEffect(() => {
    async function loadFollowData() {
      if (!currentUser) return;
      const targetUserId = isOwnProfile ? currentUser.$id : id;
      try {
        const [followers, following] = await Promise.all([
          followService.getFollowersCount(targetUserId),
          followService.getFollowingCount(targetUserId),
        ]);
        setFollowersCount(followers);
        setFollowingCount(following);
        if (!isOwnProfile) {
          setIsFollowing(await followService.isFollowing(currentUser.$id, targetUserId));
        }
      } catch (err) {
        console.error("Follow data error:", err);
      }
    }
    loadFollowData();
  }, [id, currentUser, isOwnProfile]);

  /* ── follow / unfollow ── */
  async function handleFollow() {
    if (!currentUser || loadingFollow || isOwnProfile) return;
    setLoadingFollow(true);
    try {
      if (isFollowing) {
        await followService.unfollowUser(currentUser.$id, id);
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        await followService.followUser(currentUser.$id, id, currentUser.name);
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Follow error:", err);
    } finally {
      setLoadingFollow(false);
    }
  }

  /* ── profile posts ── */
  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (!currentUser) { setLoading(false); return; }
      setLoading(true);
      try {
        const [feedPosts, favoriteRes] = await Promise.all([
          fetchFeedPosts(currentUser),
          favoriteService.getUSerAllFavorites(currentUser.$id),
        ]);
        const targetUserId = isOwnProfile ? currentUser.$id : id;
        const userPosts    = feedPosts.filter((p) => p.authorID === targetUserId);
        if (active) {
          setPosts(userPosts);
          setSavedCount(isOwnProfile ? (favoriteRes?.documents?.length || 0) : 0);
        }
      } catch (err) {
        console.error("Profile load error:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProfile();
    return () => (active = false);
  }, [id, currentUser, isOwnProfile]);

  /* ── logout ── */
  async function handleLogout() {
    try {
      await authService.logout();
      dispatch(logout());
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  /* ── guards ── */
  if (!currentUser) {
    return (
      <EmptyState
        eyebrow="Profile"
        title="Sign in to see your profile"
        description="Your avatar, saved posts, and personal grid all live here."
        actionLabel="Log in"
        actionTo="/login"
      />
    );
  }

  const profileName = isOwnProfile
    ? currentUser.name
    : posts[0]?.authorName || `User ${id?.slice(0, 6)}`;

  const bio =
    (isOwnProfile ? currentUser.prefs?.bio : "Exploring and sharing moments.") ||
    "Sharing everyday moments.";

  const visiblePosts = posts.filter((post) => {
    if (filter === "images") return !!post.featuredImg;
    if (filter === "audio")  return !!post.audioId;
    return true;
  });

  /* ── initials avatar color ── */
  const avatarColors = [
    "bg-violet-500/20 text-violet-300",
    "bg-sky-500/20 text-sky-300",
    "bg-emerald-500/20 text-emerald-300",
    "bg-amber-500/20 text-amber-300",
    "bg-rose-500/20 text-rose-300",
  ];
  const avatarColor =
    avatarColors[(profileName || "").charCodeAt(0) % avatarColors.length];
  const initials = (profileName || "?")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">

      {/* ── PROFILE HEADER ── */}
      <div className="relative overflow-hidden border-b border-white/[0.06]">

        {/* Subtle glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)" }}
        />

        <div className="relative px-5 pt-7 pb-6">

          {/* Avatar + name row */}
          <div className="flex items-center gap-4">
            {/* Big initials avatar */}
            <div
              className={`h-16 w-16 flex-shrink-0 rounded-full flex items-center justify-center text-[20px] font-extrabold ${avatarColor}`}
            >
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-[22px] font-extrabold text-white leading-tight truncate">
                {getHandle(profileName)}
              </h1>
              {isOwnProfile && (
                <p className="text-[12px] text-white/30 mt-0.5 truncate">
                  {currentUser.email}
                </p>
              )}
            </div>

            {/* Own profile actions */}
            {isOwnProfile && (
              <div className="flex-shrink-0 flex gap-2">
                <button
                  onClick={handleLogout}
                  className="px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[13px] font-semibold hover:bg-rose-500/20 transition-colors"
                >
                  Logout
                </button>
                <Link
                  to="/favorites"
                  className="px-3.5 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] text-white/60 text-[13px] font-semibold hover:bg-white/[0.08] hover:text-white/90 transition-colors"
                >
                  Saved
                </Link>
              </div>
            )}

            {/* Follow button */}
            {!isOwnProfile && (
              <button
                onClick={handleFollow}
                disabled={loadingFollow}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${
                  isFollowing
                    ? "border border-white/[0.1] bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
                    : "bg-white text-black hover:bg-white/90"
                }`}
              >
                {loadingFollow ? "…" : isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>

          {/* Bio */}
          <p className="mt-4 text-[13px] text-white/45 leading-relaxed max-w-sm">
            {bio}
          </p>

          {/* Stats strip */}
          <div className="mt-5 flex items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] py-3">
            <Stat label="Posts"     value={posts.length}    />
            <Divider />
            <Stat label="Followers" value={followersCount}  />
            <Divider />
            <Stat label="Following" value={followingCount}  />
            {isOwnProfile && (
              <>
                <Divider />
                <Stat label="Saved" value={savedCount} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── POSTS GRID ── */}
      <div>
        {/* Grid header + filters */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.05]">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/25 mb-0.5">
              {isOwnProfile ? "Your grid" : `${getHandle(profileName)}'s posts`}
            </p>
            <p className="text-[13px] text-white/40">
              {visiblePosts.length} {visiblePosts.length === 1 ? "post" : "posts"}
            </p>
          </div>

          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 ${
                  filter === f.id
                    ? "bg-white text-black"
                    : "border border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-1.5 p-1.5">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl bg-white/[0.05] animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        ) : visiblePosts.length ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-1.5 p-1.5 animate-in fade-in duration-300">
            {visiblePosts.map((post) => {
              const imageSrc = getFileUrl(post.featuredImg);
              const gradient = getPostGradient(post.$id);

              return (
                <Link
                  key={post.$id}
                  to={`/post/${post.slug}`}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-zinc-900 transition-transform duration-200 hover:scale-[0.98] hover:z-10"
                >
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div
                      className={`flex h-full w-full items-center justify-center p-4 relative overflow-hidden group/textcard ${
                        post.audioId ? `bg-gradient-to-br ${gradient}` : "bg-zinc-900"
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

                  {/* Media badge */}
                  {(post.audioId || post.featuredImg) && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {post.audioId
                        ? <PlayIcon  className="h-3 w-3 text-white/70 drop-shadow" />
                        : <ImageIcon className="h-3 w-3 text-white/70 drop-shadow" />
                      }
                    </div>
                  )}

                  {/* Stats overlay */}
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
          <div className="px-4 pt-12">
            <EmptyState
              eyebrow="Profile"
              title="No posts yet"
              description={isOwnProfile ? "Create your first post to fill your grid." : "Nothing posted here yet."}
              actionLabel={isOwnProfile ? "Create post" : undefined}
              actionTo={isOwnProfile ? "/create" : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}