// Pure moderation policy — no TensorFlow import, so it is cheap to unit test.

export const DEFAULT_THRESHOLDS = { porn: 0.7, hentai: 0.7, sexy: 0.8 };

/**
 * Turn nsfwjs predictions into an allow/deny verdict.
 * Deliberately mirrors the client-side worker so both agree.
 *
 * @param {Array<{className: string, probability: number}>} predictions
 * @param {{porn:number, hentai:number, sexy:number}} [thresholds]
 */
export function evaluatePredictions(predictions = [], thresholds = DEFAULT_THRESHOLDS) {
  const scores = {};
  for (const prediction of predictions || []) {
    if (prediction && typeof prediction.className === "string") {
      scores[prediction.className] = Number(prediction.probability) || 0;
    }
  }

  const reasons = [];
  if ((scores.Porn ?? 0) > thresholds.porn) reasons.push("explicit adult content");
  if ((scores.Hentai ?? 0) > thresholds.hentai) reasons.push("explicit illustrated content");
  if ((scores.Sexy ?? 0) > thresholds.sexy) reasons.push("sexually suggestive content");

  return { allowed: reasons.length === 0, reasons, scores };
}
