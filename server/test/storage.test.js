import test from "node:test";
import assert from "node:assert/strict";

// These must be set before env.js is imported (dotenv never overrides preset values).
process.env.AWS_ENDPOINT_URL_S3 = "https://branch-abc.storage.example.net";
process.env.STORAGE_BUCKET = "goodpost";
process.env.STORAGE_PUBLIC_BASE_URL = "";

const { publicUrl } = await import("../src/storage.js");

test("publicUrl defaults to endpoint/bucket when no base URL is configured", () => {
  assert.equal(
    publicUrl("images/thing.jpg"),
    "https://branch-abc.storage.example.net/goodpost/images/thing.jpg",
  );
});

test("publicUrl passes absolute URLs through untouched", () => {
  const absolute = "https://cdn.example.com/already/absolute.jpg";
  assert.equal(publicUrl(absolute), absolute);
});

test("publicUrl returns an empty string for a missing key", () => {
  assert.equal(publicUrl(""), "");
  assert.equal(publicUrl(null), "");
  assert.equal(publicUrl(undefined), "");
});
