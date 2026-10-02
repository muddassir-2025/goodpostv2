# GoodPost — Go-Live Checklist

Do these in order. Steps marked **→ send me** are the values I need to finish wiring and
run the migrations. Secrets go only into gitignored `.env` files.

---

## Step 0 — Rotate the leaked Appwrite key (do this first)

The old `scripts/uploadMusic.js` contained a hardcoded Appwrite API key that is still in git
history. In the Appwrite console: **revoke that key**, then create a new one only if you still
use Appwrite for anything (with the migration you don't).

---

## Step 1 — Neon project (database)

1. Create a project at <https://console.neon.tech>.
2. **Choose a supported region** for object storage later: `us-east-1`, `us-east-2`,
   `eu-central-1`, or `ap-southeast-1`.
3. Copy the **pooled** connection string:
   **Connection Details → Connection string → Pooled**.

**→ send me `DATABASE_URL`** (the pooled string with `sslmode=require`).

---

## Step 2 — Enable Neon Auth

1. Console → your project → **Auth** → **Enable Auth**.
2. Copy the **Auth Base URL** (Auth → **Configuration**).
3. Add **trusted domains / origins**: `http://localhost:5173` and your Vercel domain
   (e.g. `https://goodpost.vercel.app`). Without this, browser auth calls are rejected.
4. Enforce email/password as a provider.

**→ send me `NEON_AUTH_BASE_URL`.**

---

## Step 2b — Harden signup (email verification + rate limits)

**Email verification is a Console toggle.** No code change is needed — `/signup` already
detects whether verification is enforced and switches to a code step when it is. Until you
flip the toggle, sign-up keeps issuing a session immediately.

1. Neon Console → **Settings → Auth**.
2. Enable **Sign-up with Email** and **Verify at Sign-up**.
3. Choose **Verification codes** as the method. Codes work with Neon's shared email
   provider; verification *links* would require a custom email provider.
4. Optional: set the **Application name** so the email is branded "GoodPost" rather than
   the Neon project name.

Behaviour once enabled: sign-up returns no session, the page switches to a 6-digit code
entry (expires after 15 minutes) with a 30-second resend cooldown, and unverified accounts
cannot sign in.

**Rate limiting is already provided by Neon Auth.** The browser talks to the Neon Auth
service directly, so our API never sees signup/signin calls and cannot limit them itself.
Neon enforces its own per-IP limits (measured on this project):

| Endpoint | Observed limit |
| --- | --- |
| `/sign-up/email` | `429` on the 5th request |
| `/sign-in/email` | `429` on the 10th request |
| `/email-otp/*` | limited per endpoint; returns `TOO_MANY_ATTEMPTS` with `OTP_EXPIRED` / `INVALID_OTP` |

Our API layers a separate global limit (600 requests / 15 min per IP, `server/src/app.js`)
plus a stricter upload limit (`server/src/routes/uploads.js`). A tighter *signup* policy
would have to be enforced in front of Neon Auth, or by routing sign-up through our API —
neither is in place today.

---

## Step 3 — Google sign-in (optional but recommended)

1. <https://console.cloud.google.com> → **APIs & Services → Credentials** → create an
   **OAuth 2.0 Client ID** (type: Web application).
2. Under **Authorized redirect URIs**, paste the callback URL shown in
   **Neon Console → Auth → Providers → Google** (it looks like
   `{NEON_AUTH_BASE_URL}/callback/google`).
3. Under **Authorized JavaScript origins**, add your Vercel domain and `http://localhost:5173`.
4. Back in Neon Console → **Auth → Providers → Google**: paste the **Client ID** and
   **Client Secret** and enable it.

(No values to send me — this is configured entirely in the Neon console.)

---

## Step 4 — Neon Object Storage (media)

1. Create a **public_read** bucket (public reads, authenticated writes):

   ```bash
   neon buckets create goodpost --access-level public_read
   ```

2. Create a credential (**secrets are shown once**):

   ```bash
   neon credentials create --scope storage:read --scope storage:write --name goodpost
   ```

3. Note the branch endpoint. `neon env pull` prints all the `AWS_*` values at once:

   ```bash
   neon env pull --file server/.env
   ```

**→ send me these:**
- `AWS_REGION` (e.g. `us-east-2`)
- `AWS_ENDPOINT_URL_S3`
- `AWS_ACCESS_KEY_ID` (this is the `token_id`)
- `AWS_SECRET_ACCESS_KEY` (this is the `s3_secret_access_key`)
- bucket name (default `goodpost`)
- the public base URL: `${AWS_ENDPOINT_URL_S3}/${bucket}`

---

## Step 5 — Push the code to GitHub

The migration is local only right now. Once you're happy, it needs to be committed and pushed
to `muddassir-2025/goodpostv2` (I can create the commit on request).

---

## Step 6 — Deploy the backend on Render

1. <https://dashboard.render.com> → **New → Blueprint** (this repo includes `render.yaml`),
   or **New → Web Service** with:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
2. Fill in the environment variables (everything from Steps 1–4, plus
   `CORS_ORIGIN=https://<your-vercel-domain>`).
3. Deploy. Confirmed working when `https://<service>.onrender.com/health` returns
   `{"ok":true}`.

**→ send me the deployed URL** so I can set the frontend's `VITE_API_URL`.

> Render's **free** plan spins the service down after ~15 minutes idle, so the first request
> after a pause is slow. Attach a paid instance or a cron ping if that matters.

---

## Step 7 — Deploy the frontend on Vercel

Environment variables (Project → Settings → Environment Variables):

```
VITE_API_URL=https://<service>.onrender.com
VITE_NEON_AUTH_URL=https://ep-xxx.neonauth.<region>.aws.neon.build/neondb/auth
VITE_STORAGE_PUBLIC_URL=https://<branch-id>.storage.c-<n>.<region>.aws.neon.tech/goodpost
```

Also set `VITE_API_URL` and `VITE_STORAGE_PUBLIC_URL` so the Open Graph middleware
(`middleware.js`) can render share previews. Redeploy after saving.

---

## Step 8 — Run migrations, promote admin, smoke test

```bash
# with server/.env filled in:
npm run migrate
```

Promote yourself **either** by setting the email in `server/.env` (and on Render):

```
ADMIN_EMAILS=you@example.com
```

then signing out and back in — or, after signing up once, from the CLI:

```bash
npm --prefix server run set-admin -- you@example.com
```

You should then see a shield icon in the navbar linking to `/admin`.

Then verify: sign up → create a post with an image → like/comment → follow someone →
send a message (another browser) → notifications appear in realtime. An image that trips
moderation (or a renamed non-image) should be rejected at the upload step.

---

## What I'll do once you send the values

1. Write them into `server/.env` and `.env` (gitignored), confirm they work.
2. Run `npm run migrate` and verify all 10 tables exist.
3. Boot the API locally and hit `/health` + a couple of endpoints against real Neon.
4. Fix anything the real services surface (auth callback, CORS, storage URLs).
5. Commit and open the deploy path.
