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
  src/routes/        posts, comments, likes, favorites, follows,
                     notifications, stories, users, messages, uploads
  src/auth.js        Neon Auth JWT verification (JWKS)
  src/storage.js     Neon Object Storage (S3) client
  src/realtime.js    WebSocket server
  migrations/        SQL schema
  scripts/           migrate.js, seedMusic.js
ml-moderation-service/   Optional Google Vision image moderation service
```

## Local development

```bash
npm install
npm install --prefix server

cp .env.example .env
cp server/.env.example server/.env   # or: neon env pull --file server/.env

npm run migrate   # create the Postgres schema
npm run dev       # Vite (5173) + API (8080) + ML service
```

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for full setup (Neon, Object Storage, Render, Vercel).

## Environment variables

**Frontend** (`.env`): `VITE_API_URL`, `VITE_NEON_AUTH_URL`, `VITE_STORAGE_PUBLIC_URL`

**Backend** (`server/.env`): `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `AWS_REGION`,
`AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`,
`CORS_ORIGIN`

## Notes

- The API returns Appwrite-shaped documents (`$id`, `$createdAt`, `authorID`, `featuredImg`, …)
  so the existing UI needed almost no changes. `src/lib/appwriteCompat.js` supplies `Query`/`ID`
  shims and the backend translates queries into parameterized SQL.
- Realtime chat and notifications use WebSockets, replacing Appwrite Realtime.
- Media is uploaded through the API to a `public_read` Neon Object Storage bucket and served
  directly from `VITE_STORAGE_PUBLIC_URL`.
