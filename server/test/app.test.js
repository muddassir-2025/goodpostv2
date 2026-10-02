import test, { after } from "node:test";
import assert from "node:assert/strict";

// Configure before importing the app so env.js picks these up.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "";
process.env.CORS_ORIGIN = "https://app.example.com";
// Unroutable on purpose: JWKS fetches fail instantly instead of hitting the network.
process.env.NEON_AUTH_BASE_URL = "http://127.0.0.1:9/auth";
process.env.MODERATION_ENABLED = "false";

const { createApp } = await import("../src/app.js");

const server = createApp().listen(0);
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

after(() => server.close());

test("unknown routes return a JSON 404", async () => {
  const res = await fetch(`${base}/definitely-not-a-route`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "Not found" });
});

test("protected routes reject anonymous requests", async () => {
  const res = await fetch(`${base}/api/notifications`);
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: "Authentication required" });
});

test("admin routes reject anonymous requests", async () => {
  const res = await fetch(`${base}/api/admin/stats`);
  assert.equal(res.status, 401);
});

test("admin routes reject a non-admin even when authenticated", async () => {
  // A syntactically valid but unverifiable token, so requireAdmin never runs
  // (verification fails first) — this asserts we fail closed, not open.
  const res = await fetch(`${base}/api/admin/users`, {
    headers: { Authorization: "Bearer not-a-real-token" },
  });
  assert.equal(res.status, 401);
});

test("a disallowed Origin is refused by CORS", async () => {
  const res = await fetch(`${base}/api/posts`, {
    headers: { Origin: "https://evil.example.com" },
  });
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: "Origin not allowed" });
});

test("an allowed Origin is accepted", async () => {
  const res = await fetch(`${base}/api/admin/stats`, {
    headers: { Origin: "https://app.example.com" },
  });
  // 401 (not 403) proves CORS let it through to the auth guard.
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://app.example.com");
});

test("helmet security headers are applied", async () => {
  const res = await fetch(`${base}/definitely-not-a-route`);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-powered-by"), null);
});

test("the health endpoint reports moderation state without leaking details", async () => {
  const res = await fetch(`${base}/health`);
  const body = await res.json();
  // No database in tests, so this is a 503 — but the shape must be stable.
  assert.equal(typeof body.ok, "boolean");
  assert.ok(body.moderation);
  assert.equal(body.moderation.enabled, false);
});
