// Seeds the `music/` folder at the repo root into Neon Object Storage and creates system posts.
// Usage: npm --prefix server run seed:music
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, one } from "../src/db.js";
import { uploadBuffer } from "../src/storage.js";

const here = dirname(fileURLToPath(import.meta.url));
const MUSIC_FOLDER = process.env.MUSIC_FOLDER || join(here, "..", "..", "music");

// Stable id so re-running the seed reuses the same "System" author.
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

const AUDIO_TYPES = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
};

const formatTitle = (file) => file.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
const toSlug = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function ensureSystemUser() {
  await pool.query(
    `INSERT INTO profiles (id, email, name, is_admin)
     VALUES ($1, 'system@goodpost.local', 'System', true)
     ON CONFLICT (id) DO NOTHING`,
    [SYSTEM_USER_ID],
  );
}

async function uniqueSlug(base) {
  let slug = base || "track";
  let attempt = 2;
  while (await one("SELECT id FROM posts WHERE slug = $1", [slug])) {
    slug = `${base}-${attempt++}`;
  }
  return slug;
}

async function main() {
  await ensureSystemUser();

  let files = [];
  try {
    files = await readdir(MUSIC_FOLDER);
  } catch {
    console.log(`No music folder found at ${MUSIC_FOLDER}`);
    return;
  }

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const contentType = AUDIO_TYPES[ext];
    if (!contentType) continue;

    try {
      const buffer = await readFile(join(MUSIC_FOLDER, file));
      const key = await uploadBuffer(buffer, { contentType, extension: ext.slice(1), prefix: "music" });
      const title = formatTitle(file);
      const slug = await uniqueSlug(toSlug(title));

      await pool.query(
        `INSERT INTO posts (title, content, slug, author_id, author_name, audio_id, is_system, is_published)
         VALUES ($1, $2, $3, $4, 'System', $5, true, true)`,
        [title, "🎧 Auto uploaded music", slug, SYSTEM_USER_ID, key],
      );

      console.log(`✅ ${file} → ${key}`);
    } catch (error) {
      console.error(`❌ ${file}:`, error.message);
    }
  }

  console.log("🎉 Seed complete");
  await pool.end();
}

main().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
