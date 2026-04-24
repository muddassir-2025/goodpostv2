import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import UploadModal from "../components/UploadModal";
import { AudioIcon, ImageIcon } from "../components/ui/Icons";
import postService from "../appwrite/post";
import { createSlug, containsForbiddenWord, getFileUrl } from "../lib/ui";
import * as nsfwjs from "nsfwjs";

export default function CreatePost() {
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [audio, setAudio] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [audioPreview, setAudioPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedTags, setSelectedTags] = useState([]);
  const [customTag, setCustomTag] = useState("");

  const TAGS = ["Islamic", "Quran", "Knowledge", "Memes", "Audio", "Art", "Sports", "Travel", "Other"];

  useEffect(() => {
    if (!image) return setImagePreview("");

    const url = URL.createObjectURL(image);
    setImagePreview(url);

    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    if (!audio) return setAudioPreview("");

    const url = URL.createObjectURL(audio);
    setAudioPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [audio]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!user) return setError("Please log in before creating a post.");
    if (!content.trim()) return setError("Please add a caption before publishing.");
    if (!selectedTags.length) return setError("Select at least one tag.");

    if (containsForbiddenWord(title) || containsForbiddenWord(content) || selectedTags.some(t => containsForbiddenWord(t))) {
      return setError("Post cannot be created. It contains inappropriate language.");
    }

    setLoading(true);

    try {
      let imageId = null;
      let audioId = null;

      if (image) {
        // 1. Upload to Appwrite FIRST to generate a public URL
        const res = await postService.uploadImage(image, user.$id);
        imageId = res?.$id;

        // 🔥 2. Call ML Moderation Backend (Wait for Response)
        try {
            const imageUrl = getFileUrl(imageId); 
            
            // Use environment variable for production, fallback to relative path for local proxy
            const apiUrl = import.meta.env.VITE_MODERATION_API_URL || "";
            const modRes = await fetch(`${apiUrl}/moderate-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageUrl })
            });

            const modData = await modRes.json();

            // 3. ONLY THEN proceed if allowed
            if (modRes.ok && !modData.allowed) {
                // If the model caught it, delete from Appwrite instantly and abort!
                await postService.deleteFile(imageId);
                setLoading(false);
                return setError("Content Policy Violation: This image has been flagged for containing suggestive or inappropriate content.");
            }
        } catch (modErr) {
            console.error("Backend Moderation unavailable:", modErr);
        }
      }

      if (audio) {
        const res = await postService.uploadAudio(audio, user.$id);
        audioId = res?.$id;
      }

      const resolvedTitle =
        title.trim() ||
        content.trim().split(/\s+/).slice(0, 6).join(" ") ||
        "new-post";

      // 🔥 FIX: normalize tags
      const cleanedTags = selectedTags.map((t) => t.toLowerCase());

      await postService.createPost({
        title: resolvedTitle,
        content,
        slug: createSlug(resolvedTitle) || `post-${Date.now()}`,
        userId: user.$id,
        userName: user.name,
        imageId,
        audioId,

        // ✅ IMPORTANT FIX
        tags: cleanedTags,
      });

      navigate("/");
    } catch (err) {
      console.error("CREATE POST ERROR:", err);
      setError(err?.message || "Post creation failed.");
    } finally {
      setLoading(false);
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

  return (
    <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center py-4">
      <UploadModal
        title="Create post"
        description="Upload a photo or an audio drop, add a caption, and publish it into the feed."
        onClose={() => navigate("/")}
      >
        <form
          onSubmit={handleSubmit}
          className="grid gap-6 lg:grid-cols-[1fr,1.05fr]"
        >

          {/* LEFT SIDE */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/35 p-3">
              {imagePreview ? (
                <img
                  id="post-preview-img"
                  crossOrigin="anonymous"
                  src={imagePreview}
                  alt="Preview"
                  className="aspect-[4/5] w-full rounded-[22px] object-cover"
                />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center rounded-[22px] bg-[radial-gradient(circle_at_top,_rgba(255,115,0,0.28),_transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-10 text-center">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                      Preview
                    </p>
                    <h2 className="font-display mt-3 text-3xl text-white">
                      Your next post
                    </h2>
                  </div>
                </div>
              )}
            </div>

            {audioPreview && (
              <div className="rounded-[24px] border border-white/10 bg-black/35 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
                  Audio preview
                </p>
                <div className="rounded-full bg-zinc-100 p-1">
                  <audio controls className="w-full" src={audioPreview} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDE */}
          <div className="space-y-4">

            {error && (
              <div className="rounded-[22px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-300">
                Short title
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-[22px] border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-300">
                Caption
              </span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                className="w-full rounded-[24px] border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            {/* TAGS (UNCHANGED UI STYLE + CUSTOM INPUT) */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-zinc-300">
                Select or Add Tags (required)
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

            {/* UPLOADS */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="cursor-pointer rounded-[24px] border border-white/10 bg-black/35 p-4 transition hover:border-white/20 hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/8 text-zinc-200">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Upload image
                    </p>
                    <p className="text-xs text-zinc-500">
                      {image ? image.name : "JPG, PNG, or WebP"}
                    </p>
                  </div>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                />
              </label>

              <label className="cursor-pointer rounded-[24px] border border-white/10 bg-black/35 p-4 text-zinc-100 transition hover:border-white/20 hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/8 text-zinc-200">
                    <AudioIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      Upload audio
                    </p>
                    <p className="text-xs text-zinc-400">
                      {audio ? audio.name : "MP3, WAV, or M4A"}
                    </p>
                  </div>
                </div>

                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => setAudio(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold !text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
            >
              {loading ? "Publishing..." : "Publish post"}
            </button>
          </div>
        </form>
      </UploadModal>
    </div>
  );
}