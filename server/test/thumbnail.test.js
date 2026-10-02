import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { thumbKey } from "../src/storage.js";
import { createThumbnail } from "../src/thumbnail.js";

test("thumbKey derives a .thumb.webp companion at the same path", () => {
  assert.equal(thumbKey("images/abc.jpg"), "images/abc.thumb.webp");
  assert.equal(thumbKey("images/abc.png"), "images/abc.thumb.webp");
  assert.equal(thumbKey("images/nested/abc.webp"), "images/nested/abc.thumb.webp");
});

test("thumbKey appends the suffix when there is no extension", () => {
  assert.equal(thumbKey("images/abc"), "images/abc.thumb.webp");
});

test("thumbKey is empty for an empty key", () => {
  assert.equal(thumbKey(""), "");
  assert.equal(thumbKey(undefined), "");
});

test("createThumbnail resizes a large image down to feed width", async () => {
  const source = await sharp({
    create: { width: 1600, height: 900, channels: 3, background: "#3366ff" },
  })
    .jpeg()
    .toBuffer();

  const thumb = await createThumbnail(source);
  assert.ok(thumb, "expected a thumbnail buffer");

  const meta = await sharp(thumb).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 640);
  assert.ok(thumb.length < source.length, "thumbnail should be smaller than the original");
});

test("createThumbnail does not enlarge a small image", async () => {
  const source = await sharp({
    create: { width: 320, height: 200, channels: 3, background: "#222222" },
  })
    .jpeg()
    .toBuffer();

  const thumb = await createThumbnail(source);
  const meta = await sharp(thumb).metadata();
  assert.equal(meta.width, 320);
});

test("createThumbnail returns null for unreadable input instead of throwing", async () => {
  const result = await createThumbnail(Buffer.from("definitely not an image"));
  assert.equal(result, null);
});
