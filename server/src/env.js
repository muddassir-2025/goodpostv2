import "dotenv/config";

function optional(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function num(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function flag(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return !/^(false|0|no|off)$/i.test(value);
}

const nodeEnv = optional("NODE_ENV", "development");

export const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: Number(optional("PORT", "8080")),
  databaseUrl: optional("DATABASE_URL"),
  neonAuthBaseUrl: optional("NEON_AUTH_BASE_URL").replace(/\/+$/, ""),
  corsOrigins: optional("CORS_ORIGIN", "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Bootstrap admins by email. Matching profiles are promoted on first login.
  adminEmails: optional("ADMIN_EMAILS")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  // Optional Sentry error tracking; disabled entirely when unset.
  sentryDsn: optional("SENTRY_DSN"),
  // Neon Object Storage exposes standard AWS_* names; `neon env pull` writes them for you.
  storage: {
    region: optional("AWS_REGION", "us-east-2"),
    endpoint: optional("AWS_ENDPOINT_URL_S3").replace(/\/+$/, ""),
    accessKeyId: optional("AWS_ACCESS_KEY_ID"),
    secretAccessKey: optional("AWS_SECRET_ACCESS_KEY"),
    bucket: optional("STORAGE_BUCKET", "goodpost"),
    // Optional override; defaults to `${endpoint}/${bucket}` for public_read buckets.
    publicBaseUrl: optional("STORAGE_PUBLIC_BASE_URL").replace(/\/+$/, ""),
  },
  // In-process image moderation (nsfwjs).
  moderation: {
    enabled: flag("MODERATION_ENABLED", true),
    // "closed" rejects uploads when the model can't run; "open" lets them through.
    failPolicy: optional("MODERATION_FAIL_POLICY", "closed") === "open" ? "open" : "closed",
    // Optional self-hosted model URL; defaults to the nsfwjs MobileNetV2 model.
    modelUrl: optional("MODERATION_MODEL_URL"),
    thresholds: {
      porn: num("MODERATION_PORN_THRESHOLD", 0.7),
      hentai: num("MODERATION_HENTAI_THRESHOLD", 0.7),
      sexy: num("MODERATION_SEXY_THRESHOLD", 0.8),
    },
  },
};

/** Returns a list of missing/invalid configuration problems. */
export function configProblems() {
  const problems = [];
  if (!env.databaseUrl) problems.push("DATABASE_URL is not set");
  if (!env.neonAuthBaseUrl) problems.push("NEON_AUTH_BASE_URL is not set");
  if (!env.storage.endpoint || !env.storage.accessKeyId || !env.storage.secretAccessKey) {
    problems.push(
      "Neon Object Storage credentials are not fully set (AWS_ENDPOINT_URL_S3 / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)",
    );
  }
  if (env.isProduction && env.corsOrigins.includes("*")) {
    problems.push("CORS_ORIGIN must list explicit origins in production");
  }
  return problems;
}

/**
 * Warn in development, but refuse to boot in production with broken config.
 */
export function validateEnvOrExit() {
  const problems = configProblems();
  if (!problems.length) return;

  if (env.isProduction) {
    console.error("❌ Refusing to start in production with invalid configuration:");
    for (const problem of problems) console.error(`   - ${problem}`);
    process.exit(1);
  }

  console.warn("⚠️  Missing configuration (development only):");
  for (const problem of problems) console.warn(`   - ${problem}`);
}
