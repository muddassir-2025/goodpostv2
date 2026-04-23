import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import UploadModal from "../components/UploadModal";
import { AudioIcon, ImageIcon } from "../components/ui/Icons";
import postService from "../appwrite/post";
import { createSlug } from "../lib/ui";

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

  useEffect(() => {
    if (!image) {
      setImagePreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(image);
    setImagePreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  useEffect(() => {
    if (!audio) {
      setAudioPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(audio);
    setAudioPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [audio]);

  async function handleSubmit(event) {
  event.preventDefault();
  setError("");

  if (!user) {
    setError("Please log in before creating a post.");
    return;
  }

  // ✅ allow at least one media
  if (!content.trim()) {
    setError("Please add a caption before publishing.");
    return;
  }

  setLoading(true);

  try {
    let imageId = null;
    let audioId = null;

    // 📸 upload image only if exists
    if (image) {
      const uploadedImage = await postService.uploadImage(image, user.$id);
      imageId = uploadedImage?.$id ?? null;
    }

    // 🎵 upload audio only if exists
    if (audio) {
      const uploadedAudio = await postService.uploadAudio(audio, user.$id);
      audioId = uploadedAudio?.$id ?? null;
    }

    const resolvedTitle =
      title.trim() ||
      content.trim().split(/\s+/).slice(0, 6).join(" ") ||
      "new-post";

    await postService.createPost({
      title: resolvedTitle,
      content,
      slug: createSlug(resolvedTitle) || `post-${Date.now()}`,
      userId: user.$id,
      userName: user.name,
      imageId,
      audioId,
    });

    navigate("/");
  } catch (err) {
    setError(err?.message || "Post creation failed. Please try again.");
  } finally {
    setLoading(false);
  }
}
  return (
    <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center py-4">
      <UploadModal
        title="Create post"
        description="Upload a photo or an audio drop, add a caption, and publish it into the feed."
        onClose={() => navigate("/")}
      >
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr,1.05fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/35 p-3">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="aspect-[4/5] w-full rounded-[22px] object-cover"
                />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center rounded-[22px] bg-[radial-gradient(circle_at_top,_rgba(255,115,0,0.28),_transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-10 text-center">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Preview</p>
                    <h2 className="font-display mt-3 text-3xl text-white">Your next post</h2>
                  </div>
                </div>
              )}
            </div>

            {audioPreview ? (
              <div className="rounded-[24px] border border-white/10 bg-black/35 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-500">Audio preview</p>
                <div className="rounded-full bg-zinc-100 p-1">
                  <audio controls className="w-full" src={audioPreview} />
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
                placeholder="Sunset walk, studio drop, coffee run..."
                className="w-full rounded-[22px] border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-300">Caption</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={7}
                placeholder="Tell the story behind the moment..."
                className="w-full rounded-[24px] border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              
              <label className="cursor-pointer rounded-[24px] border border-white/10 bg-black/35 p-4 transition hover:border-white/20 hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/8 text-zinc-200">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Upload image</p>
                    <p className="text-xs text-zinc-500">
                      {image ? image.name : "JPG, PNG, or WebP"}
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
                    <p className="text-sm font-semibold text-zinc-100">Upload audio</p>
                    <p className="text-xs text-zinc-400">
                      {audio ? audio.name : "MP3, WAV, or M4A"}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold !text-zinc-950 transition hover:bg-zinc-200 hover:!text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Publishing..." : "Publish post"}
            </button>
          </div>
        </form>
      </UploadModal>
    </div>
  );
}
