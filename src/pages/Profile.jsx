import { useEffect, useState } from "react";
import { Query } from "appwrite";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../features/auth/authSlice";
import authService from "../appwrite/auth";
import EmptyState from "../components/EmptyState";
import favoriteService from "../appwrite/favorite";
import { fetchFeedPosts } from "../lib/posts";
import { formatCompactNumber, getFileUrl, getHandle } from "../lib/ui";
import followService from "../appwrite/follow";
import {
  HeartIcon,
  CommentIcon,
  PlayIcon,
  ImageIcon,
  ShieldIcon,
  PencilIcon,
  TrashIcon,
  CameraIcon,
} from "../components/ui/Icons";
import postService from "../appwrite/post";
import { login as authLogin } from "../features/auth/authSlice";
import { confirm, toast } from "../confirmService";


/* ─────────────────── helpers ─────────────────── */

const PRESET_GRADIENTS = [
  ["#6366f1", "#3b82f6"],
  ["#f43f5e", "#fb923c"],
  ["#10b981", "#14b8a6"],
  ["#2563eb", "#06b6d4"],
  ["#f59e0b", "#f43f5e"],
  ["#7c3aed", "#8b5cf6"],
  ["#db2777", "#f43f5e"],
  ["#0891b2", "#3b82f6"],
];

const getPostGradient = (id) =>
  PRESET_GRADIENTS[
    Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) %
      PRESET_GRADIENTS.length
  ];

const TYPE_FILTERS    = [
  { id: "all",    label: "All"    },
  { id: "images", label: "Images" },
  { id: "audio",  label: "Audio"  },
];

const PRIVACY_FILTERS = [
  { id: "all",     label: "All"     },
  { id: "public",  label: "Public"  },
  { id: "private", label: "Private" },
];

/* ─────────────────── sub-components ─────────────────── */

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

/* ─────────────────── main component ─────────────────── */

export default function Profile() {
  const currentUser  = useSelector((s) => s.auth.userData);
  const dispatch     = useDispatch();
  const navigate     = useNavigate();
  const { id }       = useParams();
  const isOwnProfile = !id || id === currentUser?.$id;

  const [posts,          setPosts]          = useState([]);
  const [savedCount,     setSavedCount]     = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [typeFilter,     setTypeFilter]     = useState("all");
  const [privacyFilter,  setPrivacyFilter]  = useState("all");
  const [isFollowing,    setIsFollowing]    = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loadingFollow,  setLoadingFollow]  = useState(false);
  const [isEditingName,  setIsEditingName]  = useState(false);
  const [newName,        setNewName]        = useState("");
  const [updatingUser,   setUpdatingUser]   = useState(false);
  const [uploadingAv,    setUploadingAv]    = useState(false);


  useEffect(() => {
    async function load() {
      if (!currentUser) return;
      const target = isOwnProfile ? currentUser.$id : id;
      try {
        const [followers, following] = await Promise.all([
          followService.getFollowersCount(target),
          followService.getFollowingCount(target),
        ]);
        setFollowersCount(followers);
        setFollowingCount(following);
        if (!isOwnProfile)
          setIsFollowing(await followService.isFollowing(currentUser.$id, target));
      } catch (e) { console.error(e); }
    }
    load();
  }, [id, currentUser, isOwnProfile]);

  async function handleFollow() {
    if (!currentUser || loadingFollow || isOwnProfile) return;
    setLoadingFollow(true);
    try {
      if (isFollowing) {
        await followService.unfollowUser(currentUser.$id, id);
        setIsFollowing(false);
        setFollowersCount((p) => Math.max(0, p - 1));
      } else {
        await followService.followUser(currentUser.$id, id, currentUser.name);
        setIsFollowing(true);
        setFollowersCount((p) => p + 1);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingFollow(false); }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      if (!currentUser) { setLoading(false); return; }
      setLoading(true);
      try {
        const target = isOwnProfile ? currentUser.$id : id;
        const [feedPosts, favRes] = await Promise.all([
          fetchFeedPosts(currentUser, [Query.equal("authorID", target)]),
          favoriteService.getUSerAllFavorites(currentUser.$id),
        ]);
        if (active) {
          setPosts(feedPosts);
          setSavedCount(isOwnProfile ? (favRes?.documents?.length || 0) : 0);
        }
      } catch (e) { console.error(e); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => (active = false);
  }, [id, currentUser, isOwnProfile]);

  async function handleLogout() {
    try {
      await authService.logout();
      dispatch(logout());
      navigate("/login");
    } catch (e) { console.error(e); }
  }

  async function handleDeleteAccount() {
    const confirmText = `delete account "${currentUser.name}"`;
    const isConfirmed = await confirm({
      message: "Are you absolutely sure you want to delete your account? This action cannot be undone.",
      requiredInput: confirmText
    });

    if (!isConfirmed) return;


    try {
      setUpdatingUser(true);
      await authService.deleteAccount();
      toast("Account deleted successfully.", "success");
      dispatch(logout());
      navigate("/signup");
    } catch (e) {
      console.error(e);
      toast("Failed to delete account. Please try again later.", "error");
    } finally {
      setUpdatingUser(false);
    }
  }

  async function handleUpdateName() {
    if (!newName.trim() || newName === currentUser.name) {
      setIsEditingName(false);
      return;
    }
    setUpdatingUser(true);
    try {
      await authService.updateName(newName);
      const updatedUser = await authService.getCurrentUser();
      dispatch(authLogin({ userData: updatedUser, isAdmin: currentUser.isAdmin }));

      setIsEditingName(false);
      toast("Name updated successfully.", "success");
    } catch (e) { 
      console.error(e); 
      toast("Failed to update name.", "error");
    }
    finally { setUpdatingUser(false); }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAv(true);
    try {
      const res = await postService.uploadImage(file, currentUser.$id);
      if (res) {
        await authService.updatePrefs({ avatarId: res.$id });
        const updatedUser = await authService.getCurrentUser();
        dispatch(authLogin({ userData: updatedUser, isAdmin: currentUser.isAdmin }));

        toast("Avatar updated successfully.", "success");
      }
    } catch (e) { 
      console.error(e); 
      toast("Failed to update avatar.", "error");
    }
    finally { setUploadingAv(false); }
  }



  if (!currentUser)
    return (
      <EmptyState
        eyebrow="Profile"
        title="Sign in to see your profile"
        description="Your avatar, saved posts, and personal grid all live here."
        actionLabel="Log in"
        actionTo="/login"
        actionState={{ from: window.location.pathname }}
      />
    );

  const profileName =

    isOwnProfile
      ? currentUser.name
      : posts[0]?.authorName || `User ${id?.slice(0, 6)}`;

  const bio =
    (isOwnProfile ? currentUser.prefs?.bio : "Exploring and sharing on GoodPost.") ||
    "Sharing on GoodPost.";

  const AV_COLORS = [
    ["#7c3aed", "#a78bfa"],
    ["#0284c7", "#38bdf8"],
    ["#059669", "#34d399"],
    ["#d97706", "#fbbf24"],
    ["#be185d", "#f472b6"],
  ];
  const [avBg, avFg] =
    AV_COLORS[(profileName || "").charCodeAt(0) % AV_COLORS.length];
  const initials = (profileName || "?")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const visiblePosts = posts.filter((post) => {
    const isPublic = post.isPublished !== false;
    if (isOwnProfile) {
      if (privacyFilter === "public"  && !isPublic) return false;
      if (privacyFilter === "private" &&  isPublic) return false;
    } else {
      if (!isPublic) return false;
    }
    if (typeFilter === "images" && !post.featuredImg) return false;
    if (typeFilter === "audio"  && !post.audioId)     return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">

      {/* ── PROFILE HEADER ── */}
      <div className="relative overflow-hidden border-b border-white/[0.06]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)" }}
        />

        <div className="relative px-5 pt-7 pb-6">
          {/* Avatar + name row */}
          <div className="flex items-center gap-4">
            <div className="relative group/avatar">
              <div
                className="h-16 w-16 flex-shrink-0 rounded-full flex items-center justify-center text-[20px] font-extrabold overflow-hidden relative"
                style={{ background: `${avBg}30`, color: avFg }}
              >
                {currentUser.prefs?.avatarId ? (
                  <img
                    src={getFileUrl(currentUser.prefs.avatarId)}
                    alt={profileName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
                
                {isOwnProfile && (
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer">
                    <CameraIcon className="h-5 w-5 text-white" />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      disabled={uploadingAv}
                    />
                  </label>
                )}
              </div>
              {uploadingAv && (
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center">
                  <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdateName()}
                      onBlur={() => !updatingUser && setIsEditingName(false)}
                      className="bg-white/10 border border-white/20 rounded px-2 py-0.5 text-[18px] font-extrabold text-white outline-none focus:border-indigo-500 w-full"
                    />
                  </div>
                ) : (
                  <h1 className="text-[22px] font-extrabold text-white leading-tight truncate">
                    {getHandle(profileName)}
                  </h1>
                )}
                
                {isOwnProfile && !isEditingName && (
                  <button
                    onClick={() => {
                      setNewName(currentUser.name);
                      setIsEditingName(true);
                    }}
                    className="p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {isOwnProfile && (
                <p className="text-[12px] text-white/30 mt-0.5 truncate">
                  {currentUser.email}
                </p>
              )}
            </div>

            {isOwnProfile && (
              <div className="flex-shrink-0 flex gap-2">
                <button
                  onClick={handleLogout}
                  className="px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[13px] font-semibold hover:bg-rose-500/20 transition-colors"
                >
                  Logout
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={updatingUser}
                  className="px-3.5 py-1.5 rounded-full border border-rose-500/20 bg-rose-500/5 text-rose-500/60 text-[13px] font-semibold hover:bg-rose-500/10 hover:text-rose-500 transition-colors flex items-center gap-1.5"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            )}

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
            <Stat label="Posts"     value={posts.length}   />
            <Divider />
            <Stat label="Followers" value={followersCount} />
            <Divider />
            <Stat label="Following" value={followingCount} />
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

        {/* Filter header */}
        <div className="px-5 pt-4 pb-3 border-b border-white/[0.05] space-y-2.5">

          {/* Row 1: label + type filters */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-white/25 mb-0.5">
                {isOwnProfile ? "Your grid" : `${getHandle(profileName)}'s posts`}
              </p>
              <p className="text-[13px] text-white/40">
                {visiblePosts.length}{" "}
                {visiblePosts.length === 1 ? "post" : "posts"}
              </p>
            </div>

            <div className="flex gap-1.5">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTypeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 ${
                    typeFilter === f.id
                      ? "bg-white text-black"
                      : "border border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: privacy filters — own profile only */}
          {isOwnProfile && (
            <div className="flex items-center justify-end gap-1.5">
              {PRIVACY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPrivacyFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 ${
                    privacyFilter === f.id
                      ? "bg-white text-black"
                      : "border border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
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
              const [g1, g2] = getPostGradient(post.$id);

              return (
                <Link
                  key={post.$id}
                  to={`/post/${post.slug}`}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-zinc-900 transition-transform duration-200 hover:scale-[0.98] hover:z-10"
                >
                  {imageSrc ? (
                    <>
                      <img
                        src={imageSrc}
                        alt={post.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{
                          background:
                            "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 55%)",
                        }}
                      />
                    </>
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center p-4 relative overflow-hidden"
                      style={{ background: `linear-gradient(145deg, ${g1}ee, ${g2}bb)` }}
                    >
                      <div
                        className="absolute inset-0 opacity-[0.05]"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
                          backgroundSize: "16px 16px",
                        }}
                      />
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
                          <div className="absolute inset-0 flex items-center justify-center opacity-[0.05]">
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
                        <div className="mt-2 h-0.5 w-6 bg-white/20 rounded-full group-hover:w-10 transition-all duration-300" />
                      </div>
                    </div>
                  )}

                  {/* private badge */}
                  {post.isPublished === false && (
                    <div className="absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border border-amber-500/30">
                      <ShieldIcon className="h-2.5 w-2.5 text-amber-400" />
                    </div>
                  )}

                  {/* media badge */}
                  {(post.audioId || post.featuredImg) && (
                    <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {post.audioId
                        ? <PlayIcon  className="h-2.5 w-2.5 text-white/70" />
                        : <ImageIcon className="h-2.5 w-2.5 text-white/70" />
                      }
                    </div>
                  )}

                  {/* stats overlay */}
                  <div className="absolute inset-0 flex items-end justify-start gap-3 p-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="flex items-center gap-1 text-white">
                      <HeartIcon   className="h-3.5 w-3.5 fill-current" />
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
              description={
                isOwnProfile
                  ? "Create your first post to fill your grid."
                  : "Nothing posted here yet."
              }
              actionLabel={isOwnProfile ? "Create post" : undefined}
              actionTo={isOwnProfile ? "/create" : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}