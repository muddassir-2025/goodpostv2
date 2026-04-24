import { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import FavoriteButton from "./FavoriteButton";

import { confirm } from "../confirmService";

import LikeButton from "./LikeButton";
import {
  CommentIcon,
  DotsIcon,
  EditIcon,
  PlayIcon,
  ShareIcon,
  ShieldIcon,
  TrashIcon,
} from "./ui/Icons";
import {
  formatCompactNumber,
  formatRelativeTime,
  getFileUrl,
  getHandle,
} from "../lib/ui";

export default function PostCard({
  post,
  currentUserId,
  onToggleLike,
  onToggleFavorite,
  onDelete,
  onEdit,
  onReport,
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareLabel, setShareLabel] = useState("Share");

  const isAdmin = useSelector((state) => state.auth.isAdmin);
  const isOwner = (currentUserId && currentUserId === post.authorID) || isAdmin;
  const imageSrc = getFileUrl(post.featuredImg);
  const audioSrc = getFileUrl(post.audioId);
  const captionPreview =
    post.content?.length > 150 ? `${post.content.slice(0, 150).trim()}...` : post.content;

  const openPost = () => navigate(`/post/${post.slug}`);

  const openProfile = () => navigate(`/profile/${post.authorID}`);

  async function handleShare() {
    const shareUrl = `${window.location.origin}/post/${post.slug}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareLabel("Copied");
      window.setTimeout(() => setShareLabel("Share"), 1400);
    } catch {
      navigate(`/post/${post.slug}`);
    }
  }

  return (
    <article className="group overflow-hidden rounded-[30px] border border-white/10 bg-[#121212]/92 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.34)] transition duration-300 hover:-translate-y-0.5 hover:border-white/20">
      <div className="mb-4 flex items-start justify-between gap-3">

        <button
          type="button"
          onClick={openProfile}
          className="flex items-center gap-3 text-left cursor-pointer"
        >
          <Avatar name={post.authorName} size="md" ring />
          <div>
            <p className="font-semibold text-white">
              {getHandle(post.authorName)}
            </p>
            <p className="text-xs text-zinc-500">
              {formatRelativeTime(post.$createdAt)}
            </p>
          </div>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white"
            aria-label="More options"
          >
            <DotsIcon className="h-5 w-5" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-11 z-20 w-40 rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openPost();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/5"
              >
                <CommentIcon className="h-4 w-4" />
                View post
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onReport(post.$id);
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-amber-300 transition hover:bg-amber-500/10"
              >
                <div className="flex items-center gap-2">
                  <ShieldIcon className="h-4 w-4" />
                  Report
                </div>
                {post.reportCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-md bg-amber-500/20 px-1 text-[10px] font-bold">
                    {post.reportCount}
                  </span>
                )}
              </button>

              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(post.$id);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/5"
                  >
                    <EditIcon className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      const ok = await confirm("Delete this post?");
                      if (!ok) return;
                      onDelete(post);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {(imageSrc || audioSrc) ? (
        <button
          type="button"
          onClick={openPost}
          className="block w-full overflow-hidden rounded-[26px] bg-black/50 cursor-pointer"
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={post.title}
              loading="lazy"
              className="w-full max-h-[450px] object-contain bg-zinc-900"
            />
          ) : (
            <div className="flex aspect-4/5 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,115,0,0.28),_transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-10 text-center">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Audio drop</p>
                <h3 className="font-display mt-3 text-3xl text-white">{post.title}</h3>
              </div>
            </div>
          )}
        </button>
      ) : null}

      {audioSrc ? (
        <div className="mt-3 rounded-2xl border border-white/8 bg-black/40 p-3">
          <div className="rounded-full bg-zinc-100 p-1">
            <audio controls className="w-full" src={audioSrc} />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <LikeButton
          liked={post.liked}
          count={post.likeCount}
          onToggle={() => onToggleLike(post)}
        />
        <button
          type="button"
          onClick={openPost}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
        >
          <CommentIcon className="h-5 w-5" />
          <span>{formatCompactNumber(post.commentCount || 0)}</span>
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
        >
          <ShareIcon className="h-5 w-5" />
          <span>{shareLabel}</span>
        </button>
        <FavoriteButton
          saved={post.saved}
          onToggle={() => onToggleFavorite(post)}
          className="ml-auto"
        />
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-sm font-semibold text-white">
          {formatCompactNumber(post.likeCount || 0)} likes
        </p>

        {post.title && (
          <p className="text-sm font-bold text-white">
            {post.title}
          </p>
        )}

        <p className="text-sm leading-6 text-zinc-300">
          <span className="mr-2 font-semibold text-white">{getHandle(post.authorName)}</span>
          {captionPreview || "Shared a fresh update."}
        </p>

        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {post.tags.map((tag) => (
              <button
                key={tag}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/search?q=${tag}&type=tag`);
                }}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-[2px] text-[10px] uppercase tracking-wider text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={openPost}
          className="text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          {post.commentCount ? `View all ${post.commentCount} comments` : "Be the first to comment"}
        </button>
        <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-600">
          {formatRelativeTime(post.$createdAt)}
        </p>
      </div>
    </article>
  );
}
