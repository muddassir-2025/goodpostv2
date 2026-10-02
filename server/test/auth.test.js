import test from "node:test";
import assert from "node:assert/strict";

// A realistic Neon Auth base URL — the trailing path segment is the whole point.
process.env.NEON_AUTH_BASE_URL =
  "https://ep-abc.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth";

const { jwksUrl } = await import("../src/auth.js");

test("jwksUrl appends to the full base URL, keeping the /neondb/auth path", () => {
  assert.equal(
    jwksUrl(),
    "https://ep-abc.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth/.well-known/jwks.json",
  );
});

test("jwksUrl must not resolve to the host root", () => {
  // Regression: `new URL("/.well-known/jwks.json", base)` has a leading slash,
  // so it resolves against the origin and drops the path — that URL 404s and
  // every token then fails verification with a confusing 401.
  assert.notEqual(
    jwksUrl(),
    "https://ep-abc.neonauth.c-7.us-east-2.aws.neon.tech/.well-known/jwks.json",
  );
  assert.ok(jwksUrl().includes("/neondb/auth/.well-known/jwks.json"));
});

test("jwksUrl has no doubled slash", () => {
  assert.ok(!jwksUrl().includes("//.well-known"));
  assert.ok(jwksUrl().endsWith("/.well-known/jwks.json"));
});
