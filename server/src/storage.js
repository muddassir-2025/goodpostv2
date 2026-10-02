import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { env } from "./env.js";

// Neon Object Storage is S3-compatible. Point the AWS SDK at the branch endpoint
// and use the Neon credential (token_id / s3_secret_access_key).
// forcePathStyle is required for the JS SDK with a custom S3 endpoint.
let client = null;

function getClient() {
  if (client) return client;
  if (!env.storage.endpoint || !env.storage.accessKeyId || !env.storage.secretAccessKey) {
    throw new Error("Neon Object Storage credentials are not configured");
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

export async function uploadBuffer(buffer, { contentType, extension, prefix = "uploads" }) {
  const key = `${prefix}/${randomUUID()}${extension ? `.${extension}` : ""}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.storage.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    }),
  );
  return key;
}

export async function deleteObject(key) {
  if (!key) return;
  await getClient().send(new DeleteObjectCommand({ Bucket: env.storage.bucket, Key: key }));
}
