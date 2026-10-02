import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePredictions, DEFAULT_THRESHOLDS } from "../src/moderationPolicy.js";

test("neutral images are allowed", () => {
  const verdict = evaluatePredictions([
    { className: "Neutral", probability: 0.9 },
    { className: "Drawing", probability: 0.05 },
    { className: "Porn", probability: 0.01 },
  ]);
  assert.equal(verdict.allowed, true);
  assert.deepEqual(verdict.reasons, []);
});

test("explicit adult content is blocked with a reason", () => {
  const verdict = evaluatePredictions([{ className: "Porn", probability: 0.95 }]);
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reasons.join(", "), /explicit adult content/);
});

test("hentai and suggestive content are blocked", () => {
  assert.equal(evaluatePredictions([{ className: "Hentai", probability: 0.99 }]).allowed, false);
  assert.equal(evaluatePredictions([{ className: "Sexy", probability: 0.95 }]).allowed, false);
});

test("thresholds are exclusive at the boundary", () => {
  // 0.7 is not > 0.7, so a value exactly at the line passes.
  assert.equal(evaluatePredictions([{ className: "Porn", probability: 0.7 }]).allowed, true);
  assert.equal(evaluatePredictions([{ className: "Porn", probability: 0.71 }]).allowed, false);
  assert.equal(evaluatePredictions([{ className: "Sexy", probability: 0.8 }]).allowed, true);
  assert.equal(evaluatePredictions([{ className: "Sexy", probability: 0.81 }]).allowed, false);
});

test("custom thresholds override the defaults", () => {
  const strict = { porn: 0.4, hentai: 0.4, sexy: 0.4 };
  assert.equal(evaluatePredictions([{ className: "Porn", probability: 0.5 }], strict).allowed, false);
  assert.equal(evaluatePredictions([{ className: "Porn", probability: 0.5 }], DEFAULT_THRESHOLDS).allowed, true);
});

test("multiple violations are all reported", () => {
  const verdict = evaluatePredictions([
    { className: "Porn", probability: 0.9 },
    { className: "Hentai", probability: 0.9 },
  ]);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reasons.length, 2);
});

test("malformed predictions do not throw", () => {
  assert.equal(evaluatePredictions().allowed, true);
  assert.equal(evaluatePredictions([]).allowed, true);
  assert.equal(evaluatePredictions([null, { className: "Porn" }]).allowed, true);
});

test("scores are exposed for logging", () => {
  const verdict = evaluatePredictions([{ className: "Porn", probability: 0.42 }]);
  assert.equal(verdict.scores.Porn, 0.42);
});
