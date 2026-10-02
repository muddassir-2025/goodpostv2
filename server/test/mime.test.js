import test from "node:test";
import assert from "node:assert/strict";
import { sniffMime, normalizeMime, mimeMatches } from "../src/mime.js";

const pad = (head, total = 16) => Buffer.concat([Buffer.from(head, "latin1"), Buffer.alloc(Math.max(0, total - head.length))]);

const SAMPLES = {
  jpeg: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12)]),
  png: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]),
  gif: pad("GIF89a"),
  webp: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(4)]),
  wav: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(4)]),
  ogg: pad("OggS"),
  mp3: pad("ID3"),
  webm: Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(12)]),
  html: Buffer.from("<html><script>alert(1)</script></html>"),
  svg: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'),
  zip: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(12)]),
};

test("sniffs each supported image format", () => {
  assert.equal(sniffMime(SAMPLES.jpeg), "image/jpeg");
  assert.equal(sniffMime(SAMPLES.png), "image/png");
  assert.equal(sniffMime(SAMPLES.gif), "image/gif");
  assert.equal(sniffMime(SAMPLES.webp), "image/webp");
});

test("sniffs each supported audio format", () => {
  assert.equal(sniffMime(SAMPLES.wav), "audio/wav");
  assert.equal(sniffMime(SAMPLES.ogg), "audio/ogg");
  assert.equal(sniffMime(SAMPLES.mp3), "audio/mpeg");
  assert.equal(sniffMime(SAMPLES.webm), "audio/webm");
});

test("rejects non-media payloads", () => {
  assert.equal(sniffMime(SAMPLES.html), null);
  assert.equal(sniffMime(SAMPLES.svg), null);
  assert.equal(sniffMime(SAMPLES.zip), null);
  assert.equal(sniffMime(Buffer.alloc(0)), null);
  assert.equal(sniffMime(null), null);
});

test("mimeMatches accepts a truthful declaration", () => {
  assert.equal(mimeMatches("image/jpeg", SAMPLES.jpeg).ok, true);
  assert.equal(mimeMatches("image/png", SAMPLES.png).ok, true);
});

test("mimeMatches rejects a renamed non-image", () => {
  const result = mimeMatches("image/jpeg", SAMPLES.html);
  assert.equal(result.ok, false);
  assert.match(result.reason, /Unrecognized file format/);
});

test("mimeMatches rejects a lying content type", () => {
  const result = mimeMatches("image/jpeg", SAMPLES.png);
  assert.equal(result.ok, false);
  assert.match(result.reason, /do not match/);
  assert.equal(result.detected, "image/png");
});

test("normalizeMime collapses equivalent spellings", () => {
  assert.equal(normalizeMime("audio/mp3"), "audio/mpeg");
  assert.equal(normalizeMime("audio/x-m4a"), "audio/mp4");
  assert.equal(normalizeMime("image/jpg"), "image/jpeg");
  assert.equal(normalizeMime("IMAGE/PNG"), "image/png");
});

test("mimeMatches treats audio/mpeg and audio/mp3 as the same type", () => {
  assert.equal(mimeMatches("audio/mp3", SAMPLES.mp3).ok, true);
});
