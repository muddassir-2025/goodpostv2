import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { env } from "./env.js";

// Neon Object Storage is S3-compatible. Point the AWS SDK at the branch endpoint
// and use the Neon credential (token_id / s3_secret_access_key).
// forcePathStyle is required for the JS SDK with a custom S3 endpoint.
let client = null;

/**
 * Validate the storage configuration without performing any network call.
 * A missing scheme (e.g. a bare host, or the `<branch-id>` placeholder left in
 * place) makes the AWS SDK throw a bare "Invalid URL" at request time, so we
 * surface it up front instead.
 */
export function validateStorageConfig(config = {}) {
  const problems = [];

  if (!config.endpoint) {
    problems.push("AWS_ENDPOINT_URL_S3 is not set");
  } else if (config.endpoint.includes("<")) {
    problems.push("AWS_ENDPOINT_URL_S3 still contains a placeholder value");
  } else {
    try {
      const url = new URL(config.endpoint);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        problems.push("AWS_ENDPOINT_URL_S3 must be an http(s) URL");
      }
    } catch {
      problems.push("AWS_ENDPOINT_URL_S3 is not a valid URL — did you forget the https:// prefix?");
    }
  }

  if (!config.accessKeyId) problems.push("AWS_ACCESS_KEY_ID is not set");
  if (!config.secretAccessKey) problems.push("AWS_SECRET_ACCESS_KEY is not set");
  if (!config.bucket) problems.push("STORAGE_BUCKET is not set");

  return { ok: problems.length === 0, problems };
}

/** Validate the live storage configuration. */
export function storageHealth() {
  return validateStorageConfig(env.storage);
}

function getClient() {
  if (client) return client;
  const health = storageHealth();
  if (!health.ok) {
    throw new Error(`Neon Object Storage is misconfigured: ${health.problems.join("; ")}`);
  }
  client = new S3Client({
    region: env.storage.region,
    endpoint: env.storage.endpoint,
    credentials: {
      accessKeyId: env.storage.accessKeyId,
      secretAccessKey: env.storage.secretAccessKey,
    },
    forcePathStyle: true,
  });
  return client;
}

/** Public read URL for an object in a public_read bucket. */
export function publicUrl(key) {
  if (!key) return "";
  if (/^https?:\/\//.test(key)) return key;
  const base = env.storage.publicBaseUrl || `${env.storage.endpoint}/${env.storage.bucket}`;
  if (!env.storage.endpoint) return "";
  return `${base.replace(/\/+$/, "")}/${key}`;
}

/**
 * Derive the companion thumbnail key for an image key:
 * `images/x.jpg` -> `images/x.thumb.webp`. Kept in sync with `getFileUrl(..., { thumb: true })`
 * on the client, so a change here must change there too.
 */
export function thumbKey(key) {
  if (!key) return "";
  const match = /^(.*)\.[a-zA-Z0-9]+$/.exec(key);
  return `${match ? match[1] : key}.thumb.webp`;
}

export async function uploadBuffer(buffer, { contentType, extension, prefix = "uploads", key } = {}) {
  const objectKey = key || `${prefix}/${randomUUID()}${extension ? `.${extension}` : ""}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.storage.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    }),
  );
  return objectKey;
}

export async function deleteObject(key) {
  if (!key) return;
  await getClient().send(new DeleteObjectCommand({ Bucket: env.storage.bucket, Key: key }));
}
