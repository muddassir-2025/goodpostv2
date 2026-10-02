# GoodPost v2 — Deployment Guide

GoodPost moved off Appwrite to a self-owned stack:

```
Vercel (React SPA)  ──►  Render (Node/Express API)  ──►  Neon Postgres (data + auth)
        │                          │                        Neon Object Storage (media)
        └── WebSocket (/ws) ───────┘
```

| Concern | Service | Notes |
| --- | --- | --- |
| Frontend | **Vercel** | `npm run build` → `dist/` |
| Backend API | **Render** | Web Service, root dir `server/`, WebSockets supported |
| Database | **Neon** | Postgres + Managed Better Auth (`neon_auth` schema) |
| Auth | **Neon Auth** | `@neondatabase/neon-js/auth` on the client, JWKS-verified JWTs on the API |
| Storage | **Neon Object Storage** | S3-compatible, 5 GB included on the Free plan |

---

## 1. Neon (Postgres + Auth + Object Storage)

1. Create a project at <https://console.neon.tech>.
2. Open **Auth** in the project dashboard and click **Enable Auth** (AWS regions only).
3. Copy the **Auth Base URL** from **Auth → Configuration**.
4. Copy your **pooled** connection string from **Connection Details**.
5. Create a **public_read** bucket for avatars, post images, and audio:

   ```bash
   neon buckets create goodpost --access-level public_read
   ```

6. Create a storage credential:

   ```bash
   neon credentials create --scope storage:read --scope storage:write --name goodpost
   ```

   The response prints `token_id` (→ `AWS_ACCESS_KEY_ID`) and `s3_secret_access_key`
   (→ `AWS_SECRET_ACCESS_KEY`) **once**. Save them immediately.

7. Run the migrations (from this repo):

   ```bash
   cp server/.env.example server/.env   # fill DATABASE_URL, NEON_AUTH_BASE_URL, AWS_*
   npm run migrate
   ```

   This creates `profiles`, `posts`, `comments`, `likes`, `favorites`, `follows`,
   `conversations`, `messages`, `notifications`, and `stories`.

8. To make a user an admin:

   ```sql
   UPDATE profiles SET is_admin = true WHERE email = 'you@example.com';
   ```

> **Storage URL:** objects in a `public_read` bucket are served at
> `https://<branch-id>.storage.c-<n>.<region>.aws.neon.tech/<bucket>/<key>`.

> **Credentials:** object storage is available in `us-east-1`, `us-east-2`, `eu-central-1`,
> and `ap-southeast-1`. `neon env pull` writes all `AWS_*` variables for local development.

---

## 2. Render (backend API)

1. New **Web Service** → connect this repo.
2. Settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
3. Environment variables (from `server/.env.example`):

   ```
   DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
   NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.<region>.aws.neon.build/neondb/auth

   AWS_REGION=us-east-2
   AWS_ENDPOINT_URL_S3=https://<branch-id>.storage.c-<n>.us-east-2.aws.neon.tech
   AWS_ACCESS_KEY_ID=<token_id>
   AWS_SECRET_ACCESS_KEY=<s3_secret_access_key>
   STORAGE_BUCKET=goodpost

   CORS_ORIGIN=https://your-app.vercel.app
   ```

4. Deploy, then confirm `https://<service>.onrender.com/health` returns `{"ok":true}`.

WebSockets are served on the same host at `/ws?token=<jwt>` — no extra configuration.

---

## 3. Vercel (frontend)

Environment variables:

```
VITE_API_URL=https://<service>.onrender.com
VITE_NEON_AUTH_URL=https://ep-xxx.neonauth.<region>.aws.neon.build/neondb/auth
VITE_STORAGE_PUBLIC_URL=https://<branch-id>.storage.c-<n>.us-east-2.aws.neon.tech/goodpost
```

Also set these for the Open Graph edge middleware (`middleware.js`): `VITE_API_URL`
and `VITE_STORAGE_PUBLIC_URL`.

> **CORS / cookies:** The SPA and the Neon Auth service are on different origins, so the
> auth client uses `credentials: 'include'`. Add your Vercel domain and any preview domains
> to `CORS_ORIGIN` on Render. Safari's ITP can block third-party cookies — use a custom
> domain shared between app and API if that becomes a problem.

---

## Local development

```bash
npm install
npm install --prefix server

cp .env.example .env                 # frontend vars
cp server/.env.example server/.env   # backend vars (or run `neon env pull`)

npm run migrate                      # create tables in Neon
npm run dev                          # Vite + API (+ optional ML service)
```

- Frontend: <http://localhost:5173>
- API: <http://localhost:8080> (`/health`)

---

## Data model notes

The API returns **Appwrite-shaped documents** (`$id`, `$createdAt`, plus original field names
like `authorID`, `featuredImg`, `isPublished`). This is deliberate: the UI was written against
that shape, so `src/lib/appwriteCompat.js` provides `Query` / `ID` shims and the pages needed
almost no changes.

| Frontend module | Backend route |
| --- | --- |
| `services/post.js` | `/api/posts`, `/api/uploads/*` |
| `services/comment.js` | `/api/comments` |
| `services/like.js` | `/api/likes` |
| `services/favorite.js` | `/api/favorites` |
| `services/follow.js` | `/api/follows` |
| `services/notification.js` | `/api/notifications` |
| `services/message.js` | `/api/conversations`, `/api/messages` |
| `services/story.js` | `/api/stories` |
| `services/auth.js` | Neon Auth + `/api/users/me` |

### Optional: ML moderation service

`ml-moderation-service/` is a separate Express service (Google Cloud Vision) for image
moderation. It is **not** wired into the SPA build; deploy it as its own Render service if you
want it, and point `vite.config.js`'s `/moderate-image` proxy at it for local dev.
