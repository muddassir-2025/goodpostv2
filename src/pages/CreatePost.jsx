import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import UploadModal from "../components/UploadModal";
import { AudioIcon, ImageIcon, ShieldIcon, XIcon } from "../components/ui/Icons";
import postService from "../appwrite/post";
import { createSlug, containsForbiddenWord, getFileUrl } from "../lib/ui";
import { useNSFW } from "../hooks/useNSFW";
import { toast } from "../confirmService";

export default function CreatePost() {
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();
  const { checkImage, isChecking } = useNSFW();

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
  const [status, setStatus] = useState("public");

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

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

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
        // 🔥 ULTRA-OPTIMIZED NSFW CHECK
        const checkResponse = await checkImage(image);
        
        if (!checkResponse.safe) {
          setLoading(false);
          if (checkResponse.error) {
             console.error("Worker error:", checkResponse.error);
             return setError(`Image check failed: ${checkResponse.error}`);
          }
          const reason = checkResponse.results?.Porn > 0.7 ? "Explicit content detected." : "Inappropriate content detected.";
          return setError(`Content Policy Violation: ${reason}`);
        }

        // 1. Upload to Appwrite if SAFE
        const res = await postService.uploadImage(image, user.$id);
        imageId = res?.$id;
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
        status, // ✅ Pass privacy status ("public" or "private")
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
              disabled={loading || isChecking}
              className="w-full rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold !text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
            >
              {isChecking ? "Checking image..." : loading ? "Publishing..." : "Publish post"}
            </button>
          </div>
        </form>

        {/* Minimalist Toast Notification */}
        {error && (() => {
          const isPolicyError = 
            error.includes("inappropriate") || 
            error.includes("Policy Violation") || 
            error.includes("flagged");

          return (
            <div className="absolute inset-x-0 bottom-30 z-50 flex justify-center px-4 pointer-events-none">
             <div className="pointer-events-auto flex items-center gap-4 rounded-2xl bg-zinc-900/95 px-7 py-4 shadow-[0_25px_60px_rgba(0,0,0,0.5)] border border-white/10 backdrop-blur-xl animate-in slide-in-from-bottom-2 fade-in duration-300 max-w-md w-full">
                {isPolicyError ? (
                  <ShieldIcon className="h-4 w-4 text-amber-500" />
                ) : (
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500/20">
                    <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  </div>
                )}
                <p className="text-[15px] font-medium tracking-tight text-zinc-100">
                  {error}
                </p>
                <div className="ml-2 h-4 w-px bg-white/10" />
                <button 
                  onClick={() => setError("")}
                  className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 hover:text-white transition"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </UploadModal>
    </div>
  );
}