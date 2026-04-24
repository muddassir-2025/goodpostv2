import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
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
  ImageIcon 
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
  const index = Math.abs(id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PRESET_GRADIENTS.length;
  return PRESET_GRADIENTS[index];
};

export default function Profile() {
  const currentUser = useSelector((state) => state.auth.userData);
  const { id } = useParams();

  const isOwnProfile = !id || id === currentUser?.$id;

  const [posts, setPosts] = useState([]);
  const [savedCount, setSavedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loadingFollow, setLoadingFollow] = useState(false);

  // 🔥 FOLLOW DATA
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
          const followingStatus = await followService.isFollowing(
            currentUser.$id,
            targetUserId
          );
          setIsFollowing(followingStatus);
        }
      } catch (err) {
        console.error("Follow data error:", err);
      }
    }

    loadFollowData();
  }, [id, currentUser, isOwnProfile]);

  // 🔥 FOLLOW / UNFOLLOW
  async function handleFollow() {
    if (!currentUser || loadingFollow || isOwnProfile) return;

    const targetUserId = id;

    setLoadingFollow(true);

    try {
      if (isFollowing) {
        await followService.unfollowUser(currentUser.$id, targetUserId);
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        await followService.followUser(currentUser.$id, targetUserId, currentUser.name);
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Follow error:", err);
    } finally {
      setLoadingFollow(false);
    }
  }

  // 🔥 PROFILE POSTS
  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [feedPosts, favoriteRes] = await Promise.all([
          fetchFeedPosts(currentUser),
          favoriteService.getUSerAllFavorites(currentUser.$id),
        ]);

        const targetUserId = isOwnProfile ? currentUser.$id : id;

        const userPosts = feedPosts.filter(
          (post) => post.authorID === targetUserId
        );

        if (active) {
          setPosts(userPosts);

          if (isOwnProfile) {
            setSavedCount(favoriteRes?.documents?.length || 0);
          } else {
            setSavedCount(0);
          }
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

  const [filter, setFilter] = useState("all");

  // 🔥 NOT LOGGED IN
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
    (isOwnProfile
      ? currentUser.prefs?.bio
      : "Exploring and sharing moments.") ||
    "Sharing everyday moments.";

  const followers = followersCount;
  const following = followingCount;

  // 🔥 FILTER POSTS
  const visiblePosts = posts.filter((post) => {
    if (filter === "images") return !!post.featuredImg;
    if (filter === "audio") return !!post.audioId;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* PROFILE HEADER */}
      <section className="rounded-[32px] border border-white/10 bg-[#121212]/92 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={profileName} size="xl" ring />

          <div className="flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-3xl text-white">
                  {getHandle(profileName)}
                </p>

                {isOwnProfile && (
                  <p className="mt-1 text-sm text-zinc-500">
                    {currentUser.email}
                  </p>
                )}
              </div>

              {isOwnProfile && (
                <div className="flex gap-2">
                  <Link
                    to="/create"
                    className="rounded-full bg-grey-100 px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-700 border-1 border-gray-600"
                  >
                    New post
                  </Link>
                  <Link
                    to="/favorites"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:border-white/20 hover:text-white"
                  >
                    Saved
                  </Link>
                </div>
              )}
            </div>

            {/* 🔥 FOLLOW BUTTON */}
            {!isOwnProfile && (
              <button
                onClick={handleFollow}
                disabled={loadingFollow}
                className={`mt-3 rounded-full px-5 py-2 text-sm font-semibold backdrop-blur-md border transition
                  ${
                    isFollowing
                      ? "border-white/20 text-white bg-white/5 hover:bg-white/10"
                      : "bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:opacity-90"
                  }
                `}
              >
                {loadingFollow
                  ? "Processing..."
                  : isFollowing
                  ? "Following"
                  : "Follow"}
              </button>
            )}

            <p className="mt-4 max-w-xl text-sm text-zinc-400">{bio}</p>

            {/* STATS */}
            <div className="mt-5 flex items-center rounded-[24px] border border-white/10 bg-black/35 py-4">
              <Stat label="Posts" value={posts.length} />
              <Divider />
              <Stat label="Followers" value={followers} />
              <Divider />
              <Stat label="Following" value={following} />

              {isOwnProfile && (
                <>
                  <Divider />
                  <Stat label="Saved" value={savedCount} />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* POSTS GRID */}
      <section className="rounded-[32px] border border-white/10 bg-[#121212]/92 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl text-white">
              {isOwnProfile ? "Your grid" : `${profileName}'s posts`}
            </h2>
            <p className="text-sm text-zinc-500">{visiblePosts.length} uploads</p>
          </div>

          {/* FILTER TABS */}
          <div className="flex gap-1 rounded-full border border-white/10 bg-black/40 p-1 self-start sm:self-auto">
            {["all", "images", "audio"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition ${
                  filter === f
                    ? "bg-white text-black shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <PostSkeleton count={6} />
        ) : visiblePosts.length ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {visiblePosts.map((post) => {
              const imageSrc = getFileUrl(post.featuredImg);
              const gradient = getPostGradient(post.$id);

              return (
                <Link
                  key={post.$id}
                  to={`/post/${post.slug}`}
                  className="group relative aspect-square overflow-hidden bg-zinc-900"
                >
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={post.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className={`flex h-full w-full flex-col justify-center p-4 bg-gradient-to-br ${gradient} relative overflow-hidden group/item`}>
                       {/* Subtle Grid Waveform */}
                       {post.audioId && (
                        <div className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-10 group-hover/item:opacity-30 transition-opacity">
                          {[...Array(8)].map((_, i) => (
                            <div 
                              key={i} 
                              className="w-1 bg-white rounded-full animate-waveform" 
                              style={{ 
                                height: `${30 + Math.random() * 40}%`,
                                animationDelay: `${i * 0.15}s` 
                              }} 
                            />
                          ))}
                        </div>
                      )}
                      
                      <div className="relative z-10">
                        {post.audioId && (
                          <div className="mb-2">
                            <PlayIcon className="h-5 w-5 text-white/80" />
                          </div>
                        )}
                        <h3 className="font-display text-lg sm:text-xl md:text-2xl font-extrabold text-white leading-tight line-clamp-3">
                          {post.title}
                        </h3>
                        <p className="mt-2 text-[10px] sm:text-xs text-white/70 font-medium uppercase tracking-widest">
                          {post.audioId ? "Audio Drop" : "Story"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* HOVER OVERLAY (INSTAGRAM STYLE) */}
                  <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="flex items-center gap-1.5 text-white">
                      <HeartIcon className="h-5 w-5 fill-current" />
                      <span className="text-sm font-bold">{formatCompactNumber(post.likeCount || 0)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white">
                      <CommentIcon className="h-5 w-5 fill-current" />
                      <span className="text-sm font-bold">{formatCompactNumber(post.commentCount || 0)}</span>
                    </div>
                    {post.audioId && (
                      <PlayIcon className="absolute top-3 right-3 h-4 w-4 text-white shadow-xl" />
                    )}
                    {post.featuredImg && (
                      <ImageIcon className="absolute top-3 right-3 h-4 w-4 text-white shadow-xl" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            eyebrow="Profile"
            title="No posts yet"
            description="Nothing to show here."
          />
        )}
      </section>
    </div>
  );
}

// 🔥 Small reusable components
function Stat({ label, value }) {
  return (
    <div className="flex-1 text-center">
      <p className="font-display text-lg text-white">
        {formatCompactNumber(value)}
      </p>
      <p className="text-[10px] text-zinc-500 uppercase">{label}</p>
    </div>
  );
}

function Divider() {
  return <div className="w-px bg-white/10"></div>;
}