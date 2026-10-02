import http from "node:http";
import { env, validateEnvOrExit } from "./env.js";
import { createApp } from "./app.js";
import { pool } from "./db.js";
import { setupRealtime } from "./realtime.js";
import { initMonitoring } from "./monitoring.js";
import { warmModeration } from "./moderation.js";

validateEnvOrExit();
initMonitoring();

const app = createApp();
const server = http.createServer(app);
setupRealtime(server);

server.listen(env.port, () => {
  console.log(`🚀 GoodPost API listening on port ${env.port} (${env.nodeEnv})`);
  // Load the NSFW model up front so the first upload isn't slow.
  warmModeration();
});

// Graceful shutdown so Render restarts don't drop in-flight requests.
async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    try {
      await pool.end();
    } finally {
      process.exit(0);
    }
  });
  // Force-exit if connections hang.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
