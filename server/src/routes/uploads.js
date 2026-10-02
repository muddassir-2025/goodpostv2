import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { uploadBuffer, deleteObject, publicUrl } from "../storage.js";
import { requireAuth } from "../auth.js";

const router = Router();

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
]);

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
};

function makeUploader(allowed) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    fileFilter(_req, file, cb) {
      if (!allowed.has(file.mimetype)) {
        return cb(new Error(`Unsupported file type: ${file.mimetype}`));
      }
      cb(null, true);
    },
  });
}

const imageUpload = makeUploader(IMAGE_TYPES);
const audioUpload = makeUploader(AUDIO_TYPES);

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads, please slow down" },
});

function extensionFor(file) {
  if (EXTENSIONS[file.mimetype]) return EXTENSIONS[file.mimetype];
  return "";
}

async function handleUpload(req, res, prefix) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const key = await uploadBuffer(req.file.buffer, {
      contentType: req.file.mimetype,
      extension: extensionFor(req.file),
      prefix,
    });
    // Appwrite's storage.createFile returned a file object with $id — keep that shape.
    res.status(201).json({ $id: key, key, url: publicUrl(key) });
  } catch (error) {
    console.error("upload error:", error.message);
    res.status(500).json({ error: "Upload failed" });
  }
}

router.post("/image", requireAuth, uploadLimiter, imageUpload.single("file"), (req, res) =>
  handleUpload(req, res, "images"),
);
router.post("/audio", requireAuth, uploadLimiter, audioUpload.single("file"), (req, res) =>
  handleUpload(req, res, "audio"),
);

router.post("/delete", requireAuth, async (req, res) => {
  try {
    const key = req.body?.key;
    if (key) await deleteObject(key);
    res.json({ success: true });
  } catch (error) {
    console.error("deleteFile error:", error.message);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// Multer errors (bad type / too large) reach the error handler as 500s by default.
router.use((error, _req, res, _next) => {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File is too large (max 25 MB)" });
  }
  res.status(400).json({ error: error.message || "Upload failed" });
});

export default router;
