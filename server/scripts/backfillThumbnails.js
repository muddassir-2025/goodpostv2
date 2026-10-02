// Backfill feed thumbnails for images uploaded before thumbnails shipped.
//
// New uploads get a resized WebP companion automatically. Existing posts only have the
// full-size original, so the feed requests a missing `.thumb.webp` and falls back — one
// wasted 404 per image on every load. Running this once makes the thumbnails exist:
//
//   npm run backfill:thumbs                       # keys from the posts table
//   cat keys.txt | npm run backfill:thumbs        # keys from stdin
//
// Idempotent: it re-derives and overwrites the companion for every key, which is safe
// (same deterministic key). Re-run only if needed.
import { many, pool } from "../src/db.js";
import { publicUrl, uploadBuffer, thumbKey } from "../src/storage.js";
import { createThumbnail } from "../src/thumbnail.js";
import { validateEnvOrExit } from "../src/env.js";

validateEnvOrExit();

/** Keys come from argv, then piped stdin, then (fallback) the posts table. */
async function resolveKeys() {
  const args = process.argv.slice(2).filter(Boolean);
  if (args.length) return args;

  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const piped = Buffer.concat(chunks)
      .toString()
      .split(/\s+/)
      .filter(Boolean);
    if (piped.length) return piped;
  }

  const rows = await many(
    "SELECT DISTINCT featured_img AS key FROM posts WHERE featured_img IS NOT NULL AND featured_img <> ''",
  );
  return rows.map((row) => row.key);
}

const keys = await resolveKeys();
const absolute = keys.filter((key) => /^https?:\/\//i.test(key));
const relative = keys.filter((key) => !/^https?:\/\//i.test(key));

if (absolute.length) {
  console.log(`skipping ${absolute.length} absolute URL(s) (not object keys)`);
}

let created = 0;
let failed = 0;

for (const key of relative) {
  const url = publicUrl(key);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    const thumb = await createThumbnail(buffer);
    if (!thumb) {
      failed += 1;
      console.warn(`  skip (unreadable): ${key}`);
      continue;
    }

    const target = thumbKey(key);
    await uploadBuffer(thumb, { contentType: "image/webp", key: target });
    created += 1;
    console.log(`  ok: ${key} -> ${target} (${thumb.length} bytes)`);
  } catch (error) {
    failed += 1;
    console.error(`  failed: ${key} — ${error.message}`);
  }
}

console.log(`\nbackfill complete: ${created} created, ${failed} failed, ${absolute.length} skipped`);
await pool.end();
process.exit(failed ? 1 : 0);
