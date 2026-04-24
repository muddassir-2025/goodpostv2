import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import Avatar from "../components/Avatar";
import CommentSection from "../components/CommentSection";
import EmptyState from "../components/EmptyState";
import FavoriteButton from "../components/FavoriteButton";
import LikeButton from "../components/LikeButton";
import PostSkeleton from "../components/PostSkeleton";
import {
  ArrowLeftIcon,
  CommentIcon,
  DotsIcon,
  EditIcon,
  PlayIcon,
  ShareIcon,
  ShieldIcon,
  TrashIcon,
} from "../components/ui/Icons";
import commentService from "../appwrite/comment";
import favoriteService from "../appwrite/favorite";
import likeService from "../appwrite/like";
import postService from "../appwrite/post";
import { syncFavorite, syncLike } from "../lib/engagement";
import { formatRelativeTime, getFileUrl, getHandle } from "../lib/ui";
import ShareModal from "../components/ShareModal";
import { confirm } from "../confirmService"; 

export default function SinglePost() {
  const { slug } = useParams();
  const user = useSelector((state) => state.auth.userData);
  const isAdmin = useSelector((state) => state.auth.isAdmin);
  const navigate = useNavigate();
  const commentsRef = useRef(null);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPost() {
      setLoading(true);
      setError("");

      try {
        const resolvedPost = await postService.getPost(slug);

        if (!resolvedPost) {
          if (active) {
            setPost(null);
            setComments([]);
            setError("This post could not be found.");
          }
          return;
        }

        // Privacy Check: Only owner/admin can see private posts
        const isOwner = (user?.$id === resolvedPost.authorID) || isAdmin;
        if (resolvedPost.isPublished === false && !isOwner) {
          if (active) {
            setPost(null);
            setError("This post is private and can only be viewed by the author.");
          }
          return;
        }

        const [resolvedComments, likesCount, likedRes, favoriteRes] = await Promise.all([
          commentService.getComments(resolvedPost.$id),
          likeService.countLikes(resolvedPost.$id),
          user ? likeService.getUserLike(resolvedPost.$id, user.$id) : Promise.resolve(null),
          user
            ? favoriteService.getUserFavorite(user.$id, resolvedPost.$id)
            : Promise.resolve(null),
        ]);

        if (active) {
          const safeComments = resolvedComments || [];

          setPost({
            ...resolvedPost,
            likeCount: likesCount?.total || resolvedPost.likeCount || 0,
            commentCount: safeComments.length,
            liked: likedRes?.total > 0,
            saved: favoriteRes?.total > 0,
            favoriteId: favoriteRes?.documents?.[0]?.$id || null,
          });
          setComments(safeComments);
        }
      } catch {
        if (active) {
          setError("We couldn't load this post.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPost().then(() => {
      // ✅ SCROLL TO COMMENTS IF LINKED
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("scroll") === "comments") {
        setTimeout(() => {
          commentsRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 800);
      }
    });

    return () => {
      active = false;
    };
  }, [slug, user]);

  if (loading) {
    return <PostSkeleton count={1} />;
  }

  if (!post) {
    return (
      <EmptyState
        eyebrow="Post"
        title="Post unavailable"
        description={error || "The post was removed or the link is no longer valid."}
        actionLabel="Back to feed"
        actionTo="/"
      />
    );
  }

  const isOwner = (user?.$id === post.authorID) || isAdmin;
  const imageSrc = getFileUrl(post.featuredImg);
  const audioSrc = getFileUrl(post.audioId);

  async function handleLikeToggle() {
    if (!user) {
      navigate("/login");
      return;
    }

    const previous = { liked: post.liked, likeCount: post.likeCount };
    const nextLiked = !post.liked;

    setPost((current) => ({
      ...current,
      liked: nextLiked,
      likeCount: Math.max((current.likeCount || 0) + (nextLiked ? 1 : -1), 0),
    }));

    try {
      await syncLike({
        postId: post.$id,
        userId: user.$id,
        userName: user.name,
        currentlyLiked: previous.liked,
      });
    } catch {
      setPost((current) => ({
        ...current,
        liked: previous.liked,
        likeCount: previous.likeCount,
      }));
    }
  }

  async function handleFavoriteToggle() {
    if (!user) {
      navigate("/login");
      return;
    }

    const previous = { saved: post.saved, favoriteId: post.favoriteId };
    const nextSaved = !post.saved;

    setPost((current) => ({
      ...current,
      saved: nextSaved,
      favoriteId: nextSaved ? current.favoriteId : null,
    }));

    try {
      const result = await syncFavorite({
        postId: post.$id,
        userId: user.$id,
        currentlySaved: previous.saved,
        favoriteId: previous.favoriteId,
      });

      setPost((current) => ({
        ...current,
        saved: result.saved,
        favoriteId: result.favoriteId,
      }));
    } catch {
      setPost((current) => ({
        ...current,
        saved: previous.saved,
        favoriteId: previous.favoriteId,
      }));
    }
  }

  async function handleDeletePost() {
    // if (!window.confirm("Delete this post?")) {
    //   return;
    // }

    const ok = await confirm("Delete this post?");
    if (!ok) return;

    try {
      if (post.featuredImg) {
        await postService.deleteFile(post.featuredImg);
      }

      if (post.audioId) {
        await postService.deleteFile(post.audioId);
      }

      await postService.deletePost(post.$id);
      navigate("/");
    } catch {
      setError("Delete failed. Please try again.");
    }
  }

  async function handleReport() {
    if (!user) {
      navigate("/login");
      return;
    }

    const ok = await confirm("Report this post for inappropriate content? If 5 users report it, it will be automatically removed.");
    if (!ok) return;

    try {
      const res = await postService.reportPost(post.$id, user.$id);
      
      if (res.status === "deleted") {
        toast("Post removed after multiple reports.", "warning");
        navigate("/");
      } else if (res.status === "already_reported") {
        toast("You have already reported this post.", "info");
      } else {
        toast("Report submitted successfully.", "success");
      }
    } catch {
      setError("Report failed. Please try again.");
    }
  }

  async function handleAddComment() {
    if (!user) {
      navigate("/login");
      return;
    }

    if (!newComment.trim()) {
      return;
    }

    try {
      await commentService.createComment({
        postId: post.$id,
        userId: user.$id,
        userName: user.name,
        content: newComment.trim(),
      });

      const updated = await commentService.getComments(post.$id);
      setComments(updated || []);
      setPost((current) => ({
        ...current,
        commentCount: (updated || []).length,
      }));
      setNewComment("");
    } catch {
      setError("Comment could not be posted.");
    }
  }

  function handleEditStart(comment) {
    setEditingId(comment.$id);
    setEditText(comment.content);
  }

  async function handleEditSave() {
    if (!editText.trim()) {
      return;
    }

    try {
      await commentService.updateComment(editingId, {
        content: editText.trim(),
      });

      const updated = await commentService.getComments(post.$id);
      setComments(updated || []);
      setEditingId(null);
      setEditText("");
    } catch {
      setError("Comment update failed.");
    }
  }

  async function handleDeleteComment(commentId) {
    try {
      await commentService.deleteComment(commentId, post.$id);
      const updated = await commentService.getComments(post.$id);
      setComments(updated || []);
      setPost((current) => ({
        ...current,
        commentCount: (updated || []).length,
      }));
    } catch {
      setError("Comment delete failed.");
    }
  }

  return (

    <div className="space-y-5">
      {error ? (
        <div className="rounded-[26px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <article className="overflow-hidden rounded-[32px] border border-white/10 bg-[#121212]/92 shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
        <div className="border-b border-white/10 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (window.history.length > 1) navigate(-1);
                  else navigate("/");
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-zinc-300 transition hover:border-white/20 hover:text-white"
                aria-label="Go back"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 cursor-pointer " onClick={() => navigate(`/profile/${post.authorID}`)}>
                <Avatar name={post.authorName} userId={post.authorID} size="md" ring />
                <div>
                  <p className="font-semibold text-white">{getHandle(post.authorName)}</p>
                  <p className="text-xs text-zinc-500">{formatRelativeTime(post.$createdAt)}</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white"
                aria-label="More options"
              >
                <DotsIcon className="h-5 w-5" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-11 z-20 w-40 rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      handleReport();
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

                  {isOwner && (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate(`/edit/${post.$id}`)}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/5"
                      >
                        <EditIcon className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleDeletePost}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {imageSrc ? (
          <img
            src={imageSrc}
            alt={post.title}
            className="w-full max-h-[450px] object-contain bg-zinc-900"
          />
        ) : (
          <div className="flex aspect-[4/5] items-end bg-[radial-gradient(circle_at_top,_rgba(255,115,0,0.28),_transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Feature</p>
              <h1 className="font-display mt-3 text-4xl text-white">{post.title}</h1>
            </div>
          </div>
        )}

        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <LikeButton liked={post.liked} count={post.likeCount} onToggle={handleLikeToggle} />
            <button
              type="button"
              onClick={() => commentsRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <CommentIcon className="h-5 w-5" />
              <span>{post.commentCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <ShareIcon className="h-5 w-5" />
              <span>Share</span>
            </button>
            <FavoriteButton
              saved={post.saved}
              onToggle={handleFavoriteToggle}
              className="ml-auto"
            />
          </div>

          <div className="mt-5">
            <h1 className="font-display text-3xl text-white">{post.title}</h1>
            <p className="mt-3 text-sm leading-7 text-zinc-300">{post.content}</p>
          </div>

          {audioSrc ? (
            <div className="mt-5 rounded-[26px] border border-white/8 bg-black/40 p-3">
              <div className="rounded-full bg-zinc-100 p-1">
                <audio controls className="w-full" src={audioSrc} />
              </div>
            </div>
          ) : null}
        </div>
      </article>

      <div ref={commentsRef}>
        <CommentSection
          comments={comments}
          currentUserId={user?.$id}
          value={newComment}
          onChange={setNewComment}
          onSubmit={handleAddComment}
          editingId={editingId}
          editValue={editText}
          onEditChange={setEditText}
          onEditStart={handleEditStart}
          onEditSave={handleEditSave}
          onEditCancel={() => {
            setEditingId(null);
            setEditText("");
          }}
          onDelete={handleDeleteComment}
        />
      </div>

      {shareOpen && (
        <ShareModal 
          post={post} 
          onClose={() => setShareOpen(false)} 
        />
      )}
    </div>
  );
}
