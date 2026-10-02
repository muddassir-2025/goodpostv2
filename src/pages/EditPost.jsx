import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import PostSkeleton from "../components/PostSkeleton";
import UploadModal from "../components/UploadModal";
import { AudioIcon, ImageIcon, PlayIcon, CloseIcon } from "../components/ui/Icons";
import postService from "../services/post";
import { createSlug, containsForbiddenWord, getFileUrl } from "../lib/ui";
import { CATEGORIES, searchCategories } from "../lib/categories";

export default function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.userData);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [audio, setAudio] = useState(null);
  const [video, setVideo] = useState(null);
  const [oldImageId, setOldImageId] = useState(null);
  const [oldAudioId, setOldAudioId] = useState(null);
  const [oldVideoId, setOldVideoId] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [audioPreview, setAudioPreview] = useState("");
  const [videoPreview, setVideoPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(null); // upload %, null when idle/unknown
  const [error, setError] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagQuery, setTagQuery] = useState("");
  const [status, setStatus] = useState("public");



  useEffect(() => {
    let active = true;

    async function loadPost() {
      setLoading(true);
      try {
        const post = await postService.getPostById(id);

        if (active && post) {
          setTitle(post.title || "");
          setContent(post.content || "");
          setOldImageId(post.featuredImg || null);
          setOldAudioId(post.audioId || null);
          setOldVideoId(post.videoId || null);
          
          // Stored tags are lowercase ids; keep any unknown legacy tag selectable.
          if (post.tags) {
            setSelectedTags(post.tags.map((tag) => String(tag).toLowerCase()));
          }
          setStatus(post.status || "public");
        }
      } catch {
        if (active) {
          setError("Could not load the post.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPost();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!image) {
      setImagePreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(image);
    setImagePreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  useEffect(() => {
    if (!audio) {
      setAudioPreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(audio);
    setAudioPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [audio]);

  useEffect(() => {
    if (!video) {
      setVideoPreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(video);
    setVideoPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [video]);

  async function handleUpdate(event) {
    event.preventDefault();
    setError("");

    if (containsForbiddenWord(title) || containsForbiddenWord(content) || selectedTags.some(t => containsForbiddenWord(t))) {
      return setError("Post cannot be updated. It contains inappropriate language.");
    }

    setSaving(true);

    try {
      let nextImageId = oldImageId;
      let nextAudioId = oldAudioId;
      let nextVideoId = oldVideoId;

      // Upload immediately; the API moderates before anything is stored. See CreatePost.
      if (image) {
        const uploadedImage = await postService.uploadImage(image, {
          onProgress: (percent) => setProgress(percent),
        });
        const imageId = uploadedImage?.$id || uploadedImage?.key;
        nextImageId = imageId || oldImageId;

        if (oldImageId && nextImageId !== oldImageId) {
          await postService.deleteFile(oldImageId);
        }
      }

      if (audio) {
        const uploadedAudio = await postService.uploadAudio(audio, {
          onProgress: (percent) => setProgress(percent),
        });
        nextAudioId = uploadedAudio?.$id || uploadedAudio?.key || oldAudioId;

        if (oldAudioId && nextAudioId !== oldAudioId) {
          await postService.deleteFile(oldAudioId);
        }
      }

      if (video) {
        const uploadedVideo = await postService.uploadVideo(video, {
          onProgress: (percent) => setProgress(percent),
        });
        nextVideoId = uploadedVideo?.$id || uploadedVideo?.key || oldVideoId;

        if (oldVideoId && nextVideoId !== oldVideoId) {
          await postService.deleteFile(oldVideoId);
        }
      }

      const resolvedTitle =
        title.trim() || content.trim().split(/\s+/).slice(0, 6).join(" ") || "updated-post";

      await postService.updatePost(id, {
        title: resolvedTitle,
        content,
        slug: createSlug(resolvedTitle) || `post-${Date.now()}`,
        featuredImg: nextImageId,
        audioId: nextAudioId,
        videoId: nextVideoId,
        tags: selectedTags.map(t => t.toLowerCase()),
        status, // ✅ Update privacy status
      });

      navigate("/");
    } catch (err) {
      // Surface the API's message — a moderation rejection is actionable, "Update failed" is not.
      setError(err?.message || "Update failed. Please try again.");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  const toggleTag = (id) =>
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );

  function handleTagKeyDown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const [first] = searchCategories(tagQuery, { limit: 1 });
    if (first && !selectedTags.includes(first.id)) {
      setSelectedTags((prev) => [...prev, first.id]);
      setTagQuery("");
    }
  }

  if (loading) {
    return <PostSkeleton count={1} />;
  }

  const resolvedImagePreview = imagePreview || getFileUrl(oldImageId);
  const resolvedAudioPreview = audioPreview || getFileUrl(oldAudioId);
  const resolvedVideoPreview = videoPreview || getFileUrl(oldVideoId);

  return (
    <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center py-4">
      <UploadModal
        title="Edit post"
        description="Refine the caption, swap media, and keep the post looking polished."
        onClose={() => navigate(-1)}
      >
        <form onSubmit={handleUpdate} className="grid gap-6 lg:grid-cols-[1fr,1.05fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/35 p-3">
              {resolvedVideoPreview ? (
                <video
                  src={resolvedVideoPreview}
                  controls
                  playsInline
                  className="aspect-[4/5] w-full rounded-[22px] bg-black object-contain"
                />
              ) : resolvedImagePreview ? (
                <img
                  src={resolvedImagePreview}
                  alt="Preview"
                  className="aspect-[4/5] w-full rounded-[22px] object-cover"
                />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center rounded-[22px] bg-[radial-gradient(circle_at_top,_rgba(255,115,0,0.28),_transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-10 text-center">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Preview</p>
                    <h2 className="font-display mt-3 text-3xl text-white">{title || "Edit post"}</h2>
                  </div>
                </div>
              )}
            </div>

            {resolvedAudioPreview ? (
              <div className="rounded-[24px] border border-white/10 bg-black/35 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-500">Audio preview</p>
                <div className="rounded-full bg-zinc-100 p-1">
                  <audio controls className="w-full" src={resolvedAudioPreview} />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            {error ? (
              <div className="rounded-[22px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-300">Short title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-[22px] border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
                placeholder="Title"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-300">Caption</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={7}
                className="w-full rounded-[24px] border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
                placeholder="Caption"
              />
            </label>

            {/* TAGS — searchable picker over the shared category list */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-zinc-300">Tags</span>
                <span className="text-xs text-zinc-500">
                  {selectedTags.length ? `${selectedTags.length} selected` : "Pick at least one"}
                </span>
              </div>

              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTags.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleTag(id)}
                      className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white transition hover:bg-white/20"
                    >
                      {CATEGORIES.find((c) => c.id === id)?.label || id}
                      <CloseIcon className="h-3 w-3 opacity-60" />
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Search tags..."
                className="w-full rounded-[22px] border border-white/10 bg-black/35 px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              />

              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {searchCategories(tagQuery).map((category) => {
                  const active = selectedTags.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleTag(category.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        active
                          ? "border-white bg-white text-black"
                          : "border-white/15 text-zinc-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="cursor-pointer rounded-[24px] border border-white/10 bg-black/35 p-4 transition hover:border-white/20 hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/8 text-zinc-200">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Replace image</p>
                    <p className="text-xs text-zinc-500">
                      {image ? image.name : "Keep current image"}
                    </p>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => setImage(event.target.files?.[0] || null)}
                />
              </label>

              <label className="cursor-pointer rounded-[24px] border border-white/10 bg-black/35 p-4 text-zinc-100 transition hover:border-white/20 hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/8 text-zinc-200">
                    <AudioIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">Replace audio</p>
                    <p className="text-xs text-zinc-400">
                      {audio ? audio.name : "Keep current audio"}
                    </p>
                  </div>
                </div>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(event) => setAudio(event.target.files?.[0] || null)}
                />
              </label>

              <label className="cursor-pointer rounded-[24px] border border-white/10 bg-black/35 p-4 transition hover:border-white/20 hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/8 text-zinc-200">
                    <PlayIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Replace video</p>
                    <p className="text-xs text-zinc-500">
                      {video ? video.name : "Keep current video"}
                    </p>
                  </div>
                </div>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(event) => setVideo(event.target.files?.[0] || null)}
                />
              </label>
            </div>

            {/* PRIVACY SELECTION */}
            <div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-black/35 p-4">
              <div className="space-y-0.5">
                <p className="text-[13px] font-bold text-white">Privacy</p>
                <p className="text-[11px] text-zinc-500">Visible to {status === "public" ? "everyone" : "only you"}</p>
              </div>
              <div className="flex rounded-full bg-white/5 p-1 border border-white/5">
                {["public", "private"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setStatus(opt)}
                    className={`px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
                      status === opt 
                        ? "bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.2)]" 
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {saving && progress !== null ? (
              <div className="space-y-2 pb-1">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Uploading media</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold !text-zinc-950 transition hover:bg-zinc-200 hover:!text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </UploadModal>
    </div>
  );
}
