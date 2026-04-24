import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import PostSkeleton from "../components/PostSkeleton";
import UploadModal from "../components/UploadModal";
import { AudioIcon, ImageIcon } from "../components/ui/Icons";
import postService from "../appwrite/post";
import { createSlug, containsForbiddenWord, getFileUrl } from "../lib/ui";

export default function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.userData);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [audio, setAudio] = useState(null);
  const [oldImageId, setOldImageId] = useState(null);
  const [oldAudioId, setOldAudioId] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [audioPreview, setAudioPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTag, setCustomTag] = useState("");
  const [status, setStatus] = useState("public");

  const TAGS = ["Islamic", "Quran", "Knowledge", "Memes", "Audio", "Art", "Sports", "Travel", "Other"];

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
          
          // Map stored tags back to display case
          if (post.tags) {
            const displayTags = post.tags.map(t => 
              TAGS.find(display => display.toLowerCase() === t.toLowerCase()) || t
            );
            setSelectedTags(displayTags);
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

      if (image) {
        const uploadedImage = await postService.uploadImage(image, user?.$id);
        const imageId = uploadedImage?.$id;
        nextImageId = imageId || oldImageId;

        // 🔥 2. Call ML Moderation Backend (Wait for Response)
        try {
            const imageUrl = getFileUrl(imageId); 
            
            const modRes = await fetch("http://localhost:3000/api/moderate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageUrl })
            });

            const modData = await modRes.json();

            // 3. ONLY THEN proceed if allowed
            if (modRes.ok && !modData.allowed) {
                // If the model caught it, delete from Appwrite instantly and abort!
                await postService.deleteFile(imageId);
                setSaving(false);
                return setError("Content Policy Violation: This image has been flagged for containing suggestive or inappropriate content.");
            }
        } catch (modErr) {
            console.error("Backend Moderation unavailable:", modErr);
        }

        if (oldImageId && nextImageId !== oldImageId) {
          await postService.deleteFile(oldImageId);
        }
      }

      if (audio) {
        const uploadedAudio = await postService.uploadAudio(audio, user?.$id);
        nextAudioId = uploadedAudio?.$id || oldAudioId;

        if (oldAudioId && nextAudioId !== oldAudioId) {
          await postService.deleteFile(oldAudioId);
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
        tags: selectedTags.map(t => t.toLowerCase()),
        status, // ✅ Update privacy status
      });

      navigate("/");
    } catch {
      setError("Update failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const handleAddCustomTag = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = customTag.trim();
      if (val && !selectedTags.includes(val) && val.length < 20) {
        setSelectedTags([...selectedTags, val]);
        setCustomTag("");
      }
    }
  };

  if (loading) {
    return <PostSkeleton count={1} />;
  }

  const resolvedImagePreview = imagePreview || getFileUrl(oldImageId);
  const resolvedAudioPreview = audioPreview || getFileUrl(oldAudioId);

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
              {resolvedImagePreview ? (
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

            {/* TAGS */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-zinc-300">
                Update or Add Tags (required)
              </span>
              
              <div className="flex flex-wrap gap-2 m-3">
                {[...new Set([...TAGS, ...selectedTags])].map((tag) => {
                  const active = selectedTags.includes(tag);

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSelectedTags((prev) =>
                          prev.includes(tag)
                            ? prev.filter((t) => t !== tag)
                            : [...prev, tag]
                        );
                      }}
                      className={`px-3 py-1 rounded-full text-xs border transition ${
                        active
                          ? "bg-white text-black border-white"
                          : "border-white/20 text-white hover:bg-white/10"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={handleAddCustomTag}
                placeholder="Type custom tag & press Enter"
                className="w-full rounded-[22px] border border-white/10 bg-black/35 px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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
