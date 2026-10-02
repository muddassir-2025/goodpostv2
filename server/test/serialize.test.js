import test from "node:test";
import assert from "node:assert/strict";
import { serializeRow, serializeRows, listResponse, serializeUser } from "../src/serialize.js";

test("post rows come out in Appwrite document shape", () => {
  const doc = serializeRow("posts", {
    id: "p1",
    title: "Hi",
    slug: "hi",
    created_at: "2026-01-01T00:00:00Z",
    author_id: "u1",
    featured_img: "images/x.jpg",
    is_published: true,
    like_count: 3,
    comment_count: 1,
    tags: ["a"],
  });

  assert.equal(doc.$id, "p1");
  assert.equal(doc.$createdAt, "2026-01-01T00:00:00Z");
  assert.equal(doc.authorID, "u1");
  assert.equal(doc.featuredImg, "images/x.jpg");
  assert.equal(doc.isPublished, true);
  assert.equal(doc.likeCount, 3);
  assert.deepEqual(doc.tags, ["a"]);
  // Pass-through fields keep their names.
  assert.equal(doc.title, "Hi");
  assert.equal(doc.slug, "hi");
  // Snakelike keys are renamed, not duplicated.
  assert.equal(doc.id, undefined);
  assert.equal(doc.created_at, undefined);
});

test("message rows expose the attached image key", () => {
  const doc = serializeRow("messages", {
    id: "m1",
    conversation_id: "c1",
    sender_id: "u1",
    text: "",
    image_id: "images/photo.jpg",
    created_at: "t1",
  });

  assert.equal(doc.$id, "m1");
  assert.equal(doc.conversationId, "c1");
  assert.equal(doc.senderId, "u1");
  assert.equal(doc.imageId, "images/photo.jpg");
  assert.equal(doc.image_id, undefined);
});

test("serializeRow returns null for a missing row", () => {
  assert.equal(serializeRow("posts", null), null);
});

test("serializeRows maps arrays and tolerates null", () => {
  assert.deepEqual(serializeRows("posts", null), []);
  assert.equal(serializeRows("posts", [{ id: "a" }])[0].$id, "a");
});

test("listResponse keeps an explicit total", () => {
  const res = listResponse("posts", [{ id: "1" }], 42);
  assert.equal(res.total, 42);
  assert.equal(res.documents.length, 1);
  assert.equal(res.documents[0].$id, "1");
});

test("listResponse falls back to the row count", () => {
  assert.equal(listResponse("posts", [{ id: "1" }, { id: "2" }]).total, 2);
});

test("serializeUser exposes the admin flag and bio/avatar prefs", () => {
  const user = serializeUser({
    id: "u1",
    name: "Ada",
    email: "ada@example.com",
    is_admin: true,
    bio: "hello",
    avatar_id: "images/a.jpg",
    created_at: "t1",
    updated_at: "t2",
  });

  assert.equal(user.$id, "u1");
  assert.equal(user.isAdmin, true);
  assert.equal(user.prefs.bio, "hello");
  assert.equal(user.prefs.avatarId, "images/a.jpg");
  assert.equal(user.name, "Ada");
});

test("serializeUser normalises an empty profile", () => {
  const user = serializeUser({ id: "u2", name: "Bob", email: null, is_admin: false, bio: null, avatar_id: null });
  assert.equal(user.isAdmin, false);
  assert.equal(user.prefs.bio, "");
  assert.equal(user.prefs.avatarId, null);
});
