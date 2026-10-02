import * as tf from "@tensorflow/tfjs";
import * as nsfwjs from "nsfwjs";
import sharp from "sharp";
import { env } from "./env.js";
import { evaluatePredictions } from "./moderationPolicy.js";

// The NSFW model is ~15 MB of weights and keeps roughly 90 MB resident.
// Render's free tier gives us 512 MB, so we load it once and keep it warm.
const INPUT_SIZE = 224;
// Refuse absurdly large images before sharp decodes them into memory.
const MAX_INPUT_PIXELS = 40_000_000;

let model = null;
let loading = null;
let lastError = null;

export function moderationState() {
  return {
    enabled: env.moderation.enabled,
    ready: Boolean(model),
    failPolicy: env.moderation.failPolicy,
    error: lastError,
  };
}

async function loadModel() {
  if (model) return model;
  if (loading) return loading;

  loading = nsfwjs
    .load(env.moderation.modelUrl || undefined)
    .then((loaded) => {
      model = loaded;
      lastError = null;
      console.log("[moderation] NSFW model ready");
      return loaded;
    })
    .catch((error) => {
      lastError = error.message;
      loading = null;
      throw error;
    });

  return loading;
}

/** Preload the model so the first upload isn't slow. Safe to call at boot. */
export async function warmModeration() {
  if (!env.moderation.enabled) {
    console.log("[moderation] disabled via MODERATION_ENABLED");
    return null;
  }
  try {
    return await loadModel();
  } catch (error) {
    console.error("[moderation] warmup failed:", error.message);
    return null;
  }
}

/**
 * Moderate an image buffer.
 * Returns { allowed, reason?, scores?, skipped?, error? } — never throws.
 */
export async function moderateImage(buffer) {
  if (!env.moderation.enabled) return { allowed: true, skipped: true };

  try {
    const activeModel = await loadModel();

    const { data, info } = await sharp(buffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: "none",
    })
      .rotate() // honour EXIF orientation
      .resize(INPUT_SIZE, INPUT_SIZE, { fit: "cover" })
      .toColourspace("srgb")
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.channels !== 3) {
      throw new Error(`unexpected channel count ${info.channels}`);
    }

    const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels]);
    let predictions;
    try {
      predictions = await activeModel.classify(tensor, 5);
    } finally {
      tensor.dispose();
    }

    const verdict = evaluatePredictions(predictions, env.moderation.thresholds);
    return {
      allowed: verdict.allowed,
      reason: verdict.allowed ? "Safe" : verdict.reasons.join(", "),
      scores: verdict.scores,
    };
  } catch (error) {
    lastError = error.message;
    console.error("[moderation] failed to evaluate image:", error.message);

    // Fail closed by default: if we cannot verify an image, we don't publish it.
    const failOpen = env.moderation.failPolicy === "open";
    return {
      allowed: failOpen,
      error: true,
      reason: failOpen
        ? "Moderation unavailable (allowed by MODERATION_FAIL_POLICY=open)"
        : "Image could not be verified. Please try again.",
    };
  }
}
