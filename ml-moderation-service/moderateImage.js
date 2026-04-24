import client from "./visionClient.js";

/**
 * Moderates an image using Google Cloud Vision SafeSearch
 * @param {string} imageUrl URL of the image to moderate
 * @returns {object} Moderation result with allowed flag
 */
export async function moderateImage(imageUrl) {
  try {
    const [result] = await client.safeSearchDetection(imageUrl);
    const safeSearch = result.safeSearchAnnotation;

    if (!safeSearch) {
      // Fail-safe if API doesn't return data
      return {
        allowed: false,
        reason: "Failed to analyze image content",
        raw: null
      };
    }

    const { adult, racy, violence, spoof, medical } = safeSearch;

    // Strict rule engine: Block if POSSIBLE, LIKELY, or VERY_LIKELY
    const blockList = ["POSSIBLE", "LIKELY", "VERY_LIKELY"];

    if (blockList.includes(adult)) {
      return { allowed: false, reason: "Explicit content detected", raw: safeSearch };
    }
    if (blockList.includes(racy)) {
      return { allowed: false, reason: "Suggestive content detected", raw: safeSearch };
    }
    if (blockList.includes(violence)) {
      return { allowed: false, reason: "Violent content detected", raw: safeSearch };
    }

    return {
      allowed: true,
      reason: "Safe",
      raw: safeSearch
    };
  } catch (error) {
    console.error("Vision API Error:", error);
    // Fail-safe: Block image if API fails
    return {
      allowed: false,
      reason: "Image moderation service unavailable",
      raw: null
    };
  }
}
