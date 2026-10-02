import { Router } from "express";
import { many, one, query } from "../db.js";
import { listTable } from "../list.js";
import { parseQueriesParam } from "../query.js";
import { serializeRow, listResponse } from "../serialize.js";
import { requireAuth } from "../auth.js";
import { deleteObject } from "../storage.js";

const router = Router();

async function uniqueSlug(base) {
  const clean = (base || "").trim() || "post";
  let slug = clean;
  let attempt = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await one("SELECT id FROM posts WHERE slug = $1", [slug]);
    if (!existing) return slug;
    slug = `${clean}-${attempt++}`;
  }
}

router.post("/", requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const slug = await uniqueSlug(body.slug);
    const row = await one(
      `INSERT INTO posts
         (title, content, slug, author_id, author_name, featured_img, audio_id, video_id, tags, is_published, is_system)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        body.title || "",
        body.content || "",
        slug,
        req.userId,
        body.userName || req.profile?.name || "Guest",
        body.imageId || null,
        body.audioId || null,
        body.videoId || null,
        Array.isArray(body.tags) ? body.tags : [],
        body.status ? body.status === "public" : true,
        Boolean(body.isSystem),
      ],
    );
    res.status(201).json(serializeRow("posts", row));
  } catch (error) {
    console.error("createPost error:", error.message);
    res.status(500).json({ error: "Failed to create post" });
  }
});

router.get("/", async (req, res) => {
  try {
    const queries = parseQueriesParam(req.query.queries);
    const { rows, total } = await listTable("posts", queries, {
      defaultOrder: "ORDER BY created_at DESC",
    });
    res.json(listResponse("posts", rows, total));
  } catch (error) {
    console.error("getPosts error:", error.message);
    res.status(400).json({ error: error.message });
  }
});

router.get("/search", async (req, res) => {
  try {
    const search = req.query.search || req.query.q || "";
    const rows = search
      ? await many(
          `SELECT * FROM posts WHERE title ILIKE '%' || $1 || '%' ORDER BY created_at DESC LIMIT 100`,
          [search],
        )
      : await many(`SELECT * FROM posts ORDER BY created_at DESC LIMIT 100`);
    res.json(listResponse("posts", rows, rows.length));
  } catch (error) {
    console.error("getPostBySearch error:", error.message);
    res.status(500).json({ error: "Search failed" });
  }
});

router.get("/slug/:slug", async (req, res) => {
  try {
    const row = await one("SELECT * FROM posts WHERE slug = $1", [req.params.slug]);
    res.json(row ? serializeRow("posts", row) : null);
  } catch (error) {
    console.error("getPost error:", error.message);
    res.status(500).json({ error: "Failed to load post" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const row = await one("SELECT * FROM posts WHERE id = $1", [req.params.id]);
    res.json(row ? serializeRow("posts", row) : null);
  } catch (error) {
    console.error("getPostById error:", error.message);
    res.status(500).json({ error: "Failed to load post" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await one("SELECT * FROM posts WHERE id = $1", [id]);
    if (!existing) return res.status(404).json({ error: "Post not found" });
    if (existing.author_id !== req.userId && !req.profile?.is_admin) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const body = { ...(req.body || {}) };
    if (body.status) {
      body.isPublished = body.status === "public";
      delete body.status;
    }
    delete body.$id;
    delete body.id;

    const map = {
      title: "title",
      content: "content",
      slug: "slug",
      featuredImg: "featured_img",
      audioId: "audio_id",
      videoId: "video_id",
      tags: "tags",
      isPublished: "is_published",
      likeCount: "like_count",
      commentCount: "comment_count",
      reportCount: "report_count",
      reportedBy: "reported_by",
      isSystem: "is_system",
    };

    const sets = [];
    const params = [];
    for (const [key, column] of Object.entries(map)) {
      if (key in body) {
        params.push(body[key]);
        sets.push(`${column} = $${params.length}`);
      }
    }
    if (!sets.length) {
      return res.json(serializeRow("posts", existing));
    }
    params.push(id);
    const row = await one(
      `UPDATE posts SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    res.json(serializeRow("posts", row));
  } catch (error) {
    console.error("updatePost error:", error.message);
    res.status(500).json({ error: "Failed to update post" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await one("SELECT * FROM posts WHERE id = $1", [id]);
    if (!existing) return res.status(404).json({ error: "Post not found" });
    if (existing.author_id !== req.userId && !req.profile?.is_admin) {
      return res.status(403).json({ error: "Not allowed" });
    }

    await query("DELETE FROM posts WHERE id = $1", [id]);
    for (const key of [existing.featured_img, existing.audio_id, existing.video_id]) {
      if (key) await deleteObject(key).catch(() => null);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("deletePost error:", error.message);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

router.post("/:id/report", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const post = await one("SELECT * FROM posts WHERE id = $1", [id]);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const reportedBy = post.reported_by || [];
    if (reportedBy.includes(req.userId)) return res.json({ status: "already_reported" });

    const next = [...reportedBy, req.userId];
    if (next.length >= 5) {
      await query("DELETE FROM posts WHERE id = $1", [id]);
      for (const key of [post.featured_img, post.audio_id, post.video_id]) {
        if (key) await deleteObject(key).catch(() => null);
      }
      return res.json({ status: "deleted" });
    }

    await query("UPDATE posts SET report_count = $2, reported_by = $3, updated_at = now() WHERE id = $1", [
      id,
      next.length,
      next,
    ]);
    res.json({ status: "reported" });
  } catch (error) {
    console.error("reportPost error:", error.message);
    res.status(500).json({ error: "Failed to report post" });
  }
});

export default router;
