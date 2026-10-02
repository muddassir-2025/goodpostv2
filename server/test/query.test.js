import test from "node:test";
import assert from "node:assert/strict";
import { buildQuery, parseQueriesParam } from "../src/query.js";

test("equal with a single value becomes a parameterized comparison", () => {
  const q = buildQuery("posts", [{ method: "equal", attribute: "isPublished", values: [true] }]);
  assert.equal(q.where, "WHERE is_published = $1");
  assert.deepEqual(q.params, [true]);
});

test("equal with several values collapses into ANY()", () => {
  const q = buildQuery("posts", [{ method: "equal", attribute: "slug", values: ["a", "b"] }]);
  assert.equal(q.where, "WHERE slug = ANY($1)");
  assert.deepEqual(q.params, [["a", "b"]]);
});

test("contains maps to = ANY(column) for array columns", () => {
  const q = buildQuery("posts", [{ method: "contains", attribute: "tags", values: ["music"] }]);
  assert.equal(q.where, "WHERE $1 = ANY(tags)");
  assert.deepEqual(q.params, ["music"]);
});

test("search uses ILIKE with a bound parameter", () => {
  const q = buildQuery("posts", [{ method: "search", attribute: "title", values: ["rock"] }]);
  assert.match(q.where, /title ILIKE/);
  assert.deepEqual(q.params, ["rock"]);
});

test("order, limit and offset are collected separately", () => {
  const q = buildQuery("posts", [
    { method: "orderDesc", attribute: "$createdAt" },
    { method: "limit", values: [25] },
    { method: "offset", values: [50] },
  ]);
  assert.equal(q.order, "ORDER BY created_at DESC");
  assert.equal(q.limit, 25);
  assert.equal(q.offset, 50);
});

test("multiple where clauses are ANDed with increasing parameter indexes", () => {
  const q = buildQuery("posts", [
    { method: "equal", attribute: "isPublished", values: [true] },
    { method: "equal", attribute: "authorID", values: ["u1"] },
  ]);
  assert.equal(q.where, "WHERE is_published = $1 AND author_id = $2");
  assert.deepEqual(q.params, [true, "u1"]);
});

test("messages expose imageId in the column whitelist", () => {
  const q = buildQuery("messages", [{ method: "isNotNull", attribute: "imageId" }]);
  assert.equal(q.where, "WHERE image_id IS NOT NULL");
});

test("unknown attributes are rejected — the SQL injection guard", () => {
  assert.throws(
    () => buildQuery("posts", [{ method: "equal", attribute: "id; DROP TABLE posts", values: ["x"] }]),
    /Unsupported query attribute/,
  );
});

test("unknown query methods are ignored rather than failing the request", () => {
  const q = buildQuery("posts", [{ method: "whatever", attribute: "$id" }]);
  assert.equal(q.where, "");
  assert.equal(q.params.length, 0);
});

test("parseQueriesParam tolerates junk", () => {
  assert.deepEqual(parseQueriesParam(undefined), []);
  assert.deepEqual(parseQueriesParam("not json"), []);
  assert.deepEqual(parseQueriesParam('{"a":1}'), []); // object, not array
  assert.equal(parseQueriesParam('[{"method":"limit","values":[1]}]').length, 1);
});
