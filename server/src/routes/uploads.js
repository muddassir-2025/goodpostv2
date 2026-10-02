import { Router } from "express";
import multer from "multer";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { uploadBuffer, deleteObject, publicUrl } from "../storage.js";
import { requireAuth } from "../auth.js";
import { mimeMatches } from "../mime.js";
import { moderateImage } from "../moderation.js";
import { bumpMetric } from "../monitoring.js";

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

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function makeUploader(allowed) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
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

// Rate limit per authenticated user, not just per IP, so one account can't flood us.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  // Attribute the limit to the account when signed in, otherwise to the client IP.
  keyGenerator: (req) => (req.userId ? `user:${req.userId}` : ipKeyGenerator(req.ip)),
  message: { error: "Too many uploads, please slow down" },
});

function extensionFor(file) {
  return EXTENSIONS[file.mimetype] || "";
}

async function storeAndRespond(req, res, prefix) {
  const key = await uploadBuffer(req.file.buffer, {
    contentType: req.file.mimetype,
    extension: extensionFor(req.file),
    prefix,
  });
  bumpMetric("uploads");
  // Appwrite's storage.createFile returned a file object with $id — keep that shape.
  return res.status(201).json({ $id: key, key, url: publicUrl(key) });
}

router.post("/image", requireAuth, uploadLimiter, imageUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    // 1. Verify the bytes really are the image type the browser claimed.
    const match = mimeMatches(req.file.mimetype, req.file.buffer);
    if (!match.ok) {
      bumpMetric("uploadsRejected");
      return res.status(400).json({ error: match.reason });
    }

    // 2. Moderate before the object ever reaches public storage.
    const verdict = await moderateImage(req.file.buffer);
    if (!verdict.allowed) {
      bumpMetric("uploadsRejected");
      if (verdict.error) {
        // Couldn't evaluate the image — retryable, not a policy violation.
        return res.status(503).json({ error: verdict.reason });
      }
      bumpMetric("moderationBlocked");
      return res.status(422).json({
        error: `Image rejected: ${verdict.reason}`,
        moderation: { reason: verdict.reason },
      });
    }

    // 3. Only now does it get published.
    return await storeAndRespond(req, res, "images");
  } catch (error) {
    console.error("image upload error:", error.message);
    return res.status(500).json({ error: "Upload failed" });
  }
});

router.post("/audio", requireAuth, uploadLimiter, audioUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const match = mimeMatches(req.file.mimetype, req.file.buffer);
    if (!match.ok) {
      bumpMetric("uploadsRejected");
      return res.status(400).json({ error: match.reason });
    }

    return await storeAndRespond(req, res, "audio");
  } catch (error) {
    console.error("audio upload error:", error.message);
    return res.status(500).json({ error: "Upload failed" });
  }
});

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
