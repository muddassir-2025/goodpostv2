# GoodPost v2

A social posting app — feed, reels, stories, comments, likes, favorites, follows, direct
messages, and notifications. Built with React + Vite on the frontend, an Express API on
Render, and Neon for Postgres, auth, and object storage.

```
Vercel (React SPA)  ──►  Render (Node/Express API)  ──►  Neon Postgres (data + auth)
        │                          │                        Neon Object Storage (media)
        └── WebSocket (/ws) ───────┘
```

## Stack

- **Frontend:** React 19, Vite, Redux Toolkit, React Router, Tailwind CSS, Framer Motion
- **Backend:** Node/Express, `pg`, `ws` (WebSockets), `jose` (JWT verification), `multer`
- **Database:** Neon Postgres
- **Auth:** Neon Auth (Managed Better Auth) — email/password + Google OAuth
- **Storage:** Neon Object Storage (S3-compatible, 5 GB free)
- **Moderation:** in-process NSFW classification (`nsfwjs` + `sharp`) — no separate service
- **Monitoring:** optional Sentry error tracking + in-process counters
- **Hosting:** Vercel (frontend) + Render (API)

## Project structure

```
src/                 React app
  api/               fetch client for the backend
  auth.js            Neon Auth client + cached JWT
  services/          API-backed service layer (was src/appwrite/*)
  lib/               helpers (ui, posts, appwriteCompat, realtime)
  pages/  components/  features/  hooks/
server/              Express API (deploy to Render)
  src/app.js         Express app factory (testable without listening)
  src/index.js       entrypoint: validate config, listen, warm the model
  src/routes/        posts, comments, likes, favorites, follows, notifications,
                     stories, users, messages, uploads, admin
  src/auth.js        Neon Auth JWT verification (JWKS) + admin bootstrap
  src/storage.js     Neon Object Storage (S3) client
  src/realtime.js    WebSocket server
  src/moderation.js  In-process NSFW image moderation (nsfwjs + sharp)
  src/mime.js        Magic-byte content sniffing for uploads
  src/monitoring.js  Optional Sentry + in-process counters
  migrations/        SQL schema
  scripts/           migrate.js, seedMusic.js, setAdmin.js
  test/              node:test suite
```

## Local development

```bash
npm install
npm install --prefix server

cp .env.example .env
cp server/.env.example server/.env   # or: neon env pull --file server/.env

npm run migrate   # create the Postgres schema
npm run dev       # Vite (5173) + API (8080)
```

Run the backend test suite and lint with:

```bash
npm --prefix server test   # node:test — no database required
npm run lint
```

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for full setup (Neon, Object Storage, Render, Vercel).

## Environment variables

**Frontend** (`.env`): `VITE_API_URL`, `VITE_NEON_AUTH_URL`, `VITE_STORAGE_PUBLIC_URL`

**Backend** (`server/.env`): `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `AWS_REGION`,
`AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`,
`CORS_ORIGIN`, `ADMIN_EMAILS`

Optional backend vars: `MODERATION_ENABLED` (default `true`), `MODERATION_FAIL_POLICY`
(`closed`), `MODERATION_PORN_THRESHOLD` / `MODERATION_HENTAI_THRESHOLD` /
`MODERATION_SEXY_THRESHOLD`, `MODERATION_MODEL_URL`, `SENTRY_DSN`

## Notes

- The API returns Appwrite-shaped documents (`$id`, `$createdAt`, `authorID`, `featuredImg`, …)
  so the existing UI needed almost no changes. `src/lib/appwriteCompat.js` supplies `Query`/`ID`
  shims and the backend translates queries into parameterized SQL.
- Realtime chat and notifications use WebSockets, replacing Appwrite Realtime.
- Media is uploaded through the API to a `public_read` Neon Object Storage bucket and served
  directly from `VITE_STORAGE_PUBLIC_URL`.
- Uploads are verified server-side: magic-byte sniffing rejects files whose bytes don't match
  their declared type, and images are NSFW-checked **before** they reach public storage. The
  browser-side check still runs for instant feedback, but it is no longer the only line of
  defence.
- Admins are a `profiles.is_admin` flag (Neon Auth has no teams concept). Bootstrap the first
  one with `ADMIN_EMAILS`, or run `npm --prefix server run set-admin -- you@example.com`.
  Admins get a `/admin` dashboard for promoting users and reviewing reported posts.
