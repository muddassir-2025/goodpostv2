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
        await followService.followUser(currentUser.$id, targetUserId);
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
          <PostSkeleton count={2} />
        ) : visiblePosts.length ? (
          <div className="grid grid-cols-3 gap-3">
            {visiblePosts.map((post) => {
              const imageSrc = getFileUrl(post.featuredImg);

              return (
                <Link
                  key={post.$id}
                  to={`/post/${post.slug}`}
                  className="group rounded-[24px] overflow-hidden border border-white/10 cursor-pointer"
                >
                  <div className="aspect-square relative overflow-hidden">
                    {imageSrc ? (
                      <>
                        <img
                          src={imageSrc}
                          alt={post.title}
                          className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                        />

                        <div className="absolute inset-0 flex items-end p-3
                          bg-[linear-gradient(to_top,rgba(0,0,0,0.75),rgba(0,0,0,0.15),transparent)]
                        ">
                          <p className="text-white text-sm font-semibold line-clamp-2">
                            {post.title}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-end p-3
                        bg-[radial-gradient(circle_at_top,_rgba(255,115,0,0.25),_transparent_50%),linear-gradient(to_top,rgba(0,0,0,0.7),rgba(0,0,0,0.1))]
                        backdrop-blur-md
                      ">
                        <p className="text-white text-sm font-semibold">
                          {post.title}
                        </p>
                      </div>
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