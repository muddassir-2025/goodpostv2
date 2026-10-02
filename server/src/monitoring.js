import * as Sentry from "@sentry/node";
import { env } from "./env.js";

let sentryEnabled = false;

const counters = {
  requests: 0,
  errors: 0,
  uploads: 0,
  uploadsRejected: 0,
  moderationBlocked: 0,
};

/** Initialise Sentry only when a DSN is configured. */
export function initMonitoring() {
  if (!env.sentryDsn) {
    console.log("[monitoring] SENTRY_DSN not set — Sentry disabled (in-process counters still active)");
    return false;
  }
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    // Errors only — keeps us comfortably inside the free tier.
    tracesSampleRate: 0,
  });
  sentryEnabled = true;
  console.log("[monitoring] Sentry error tracking enabled");
  return true;
}

export function captureError(error, context = {}) {
  if (!sentryEnabled) return;
  try {
    Sentry.captureException(error, { extra: context });
  } catch {
    // Never let monitoring take down a request.
  }
}

export function bumpMetric(name, by = 1) {
  if (name in counters) counters[name] += by;
}

export function metrics() {
  return {
    ...counters,
    sentryEnabled,
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  };
}
