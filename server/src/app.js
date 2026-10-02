import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./env.js";
import { pool } from "./db.js";
import { attachUser } from "./auth.js";
import { bumpMetric, captureError } from "./monitoring.js";
import { moderationState } from "./moderation.js";
import { storageHealth } from "./storage.js";
import postsRouter from "./routes/posts.js";
import commentsRouter from "./routes/comments.js";
import likesRouter from "./routes/likes.js";
import favoritesRouter from "./routes/favorites.js";
import followsRouter from "./routes/follows.js";
import notificationsRouter from "./routes/notifications.js";
import storiesRouter from "./routes/stories.js";
import usersRouter from "./routes/users.js";
import messagesRouter from "./routes/messages.js";
import uploadsRouter from "./routes/uploads.js";
import adminRouter from "./routes/admin.js";

export function createApp() {
  const app = express();

  // Render terminates TLS in front of the service, so trust its proxy for correct client IPs.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      // This API is consumed cross-origin by the SPA and by <img> tags.
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes("*") || env.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  // Concise request logging.
  app.use((req, res, next) => {
    bumpMetric("requests");
    const start = Date.now();
    res.on("finish", () => {
      if (req.path === "/health") return;
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  // Global rate limit per IP.
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 600,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Health check for Render.
  app.get("/health", async (_req, res) => {
    const moderation = moderationState();
    const storage = storageHealth();
    const body = {
      ok: true,
      db: "up",
      moderation: { enabled: moderation.enabled, ready: moderation.ready },
      // Boolean only — this endpoint is public, so no config detail leaks here.
      storage: storage.ok,
    };
    try {
      await pool.query("SELECT 1");
      res.json(body);
    } catch {
      res.status(503).json({ ...body, ok: false, db: "down" });
    }
  });

  // Attach the authenticated user (if any) to every /api request.
  app.use("/api", attachUser);

  app.use("/api/posts", postsRouter);
  app.use("/api/comments", commentsRouter);
  app.use("/api/likes", likesRouter);
  app.use("/api/favorites", favoritesRouter);
  app.use("/api/follows", followsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/stories", storiesRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/users", usersRouter);
  app.use("/api", messagesRouter); // /api/conversations, /api/messages

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((error, req, res, _next) => {
    if (error?.message?.includes("not allowed by CORS")) {
      return res.status(403).json({ error: "Origin not allowed" });
    }
    bumpMetric("errors");
    console.error("Unhandled error:", error?.message);
    captureError(error, { path: req.originalUrl, method: req.method });
    res.status(error?.status || 500).json({
      error: env.isProduction ? "Internal server error" : error?.message || "Internal server error",
    });
  });

  return app;
}
