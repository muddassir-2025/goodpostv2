import test from "node:test";
import assert from "node:assert/strict";
import { validateStorageConfig } from "../src/storage.js";

const VALID = {
  endpoint: "https://branch.storage.c-7.us-east-2.aws.neon.tech",
  accessKeyId: "token_id_value",
  secretAccessKey: "secret_value",
  bucket: "goodpost",
};

test("a complete, well-formed config is healthy", () => {
  const result = validateStorageConfig(VALID);
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
});

test("an endpoint without a scheme is reported (this caused a live 'Invalid URL' 500)", () => {
  const result = validateStorageConfig({
    ...VALID,
    endpoint: "branch.storage.c-7.us-east-2.aws.neon.tech",
  });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /not a valid URL/);
});

test("a leftover placeholder is reported", () => {
  const result = validateStorageConfig({
    ...VALID,
    endpoint: "https://<branch-id>.storage.c-<n>.us-east-2.aws.neon.tech",
  });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /placeholder/);
});

test("a non-http protocol is reported", () => {
  const result = validateStorageConfig({ ...VALID, endpoint: "ftp://example.com" });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /http\(s\)/);
});

test("a missing endpoint is reported", () => {
  const result = validateStorageConfig({ ...VALID, endpoint: "" });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /not set/);
});

test("missing credentials are reported", () => {
  const result = validateStorageConfig({ ...VALID, accessKeyId: "", secretAccessKey: "" });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /AWS_ACCESS_KEY_ID/);
  assert.match(result.problems.join(" "), /AWS_SECRET_ACCESS_KEY/);
});

test("a missing bucket is reported", () => {
  const result = validateStorageConfig({ ...VALID, bucket: "" });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /STORAGE_BUCKET/);
});

test("every problem is collected, not just the first", () => {
  const result = validateStorageConfig({});
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 4);
});
