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

    // Rules: Block if LIKELY or VERY_LIKELY. 
    // 'POSSIBLE' is often a false positive in SafeSearch.
    const blockList = ["LIKELY", "VERY_LIKELY"];

    if (blockList.includes(adult)) {
      return { allowed: false, reason: "Explicit content detected (Adult)", raw: safeSearch };
    }
    if (blockList.includes(racy)) {
      return { allowed: false, reason: "Suggestive content detected (Racy)", raw: safeSearch };
    }
    if (blockList.includes(violence)) {
      return { allowed: false, reason: "Violent content detected (Violence)", raw: safeSearch };
    }

    return {
      allowed: true,
      reason: "Safe",
      raw: safeSearch
    };
  } catch (error) {
    console.error("Vision API Error Details:", error);
    // Return a specific error so the frontend can distinguish between "Flagged" and "Error"
    return {
      allowed: false,
      error: true,
      reason: "Moderation service technical error",
      details: error.message
    };
  }
}
