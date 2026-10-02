import { jwtVerify, createRemoteJWKSet } from "jose";
import { env } from "./env.js";
import { one, query } from "./db.js";

let jwks = null;
function getJwks() {
  if (!jwks) {
    if (!env.neonAuthBaseUrl) throw new Error("NEON_AUTH_BASE_URL is not configured");
    const url = new URL("/.well-known/jwks.json", env.neonAuthBaseUrl);
    jwks = createRemoteJWKSet(url);
  }
  return jwks;
}

/**
 * Verify a Neon Auth (Managed Better Auth) JWT.
 * Tokens are EdDSA-signed and expire in ~15 minutes; the SPA refreshes via authClient.token().
 */
export async function verifyToken(token) {
  if (!token) return null;
  const issuer = new URL(env.neonAuthBaseUrl).origin;
  try {
    const { payload } = await jwtVerify(token, getJwks(), { issuer });
    return payload;
  } catch (error) {
    console.warn("JWT verification failed:", error.message);
    return null;
  }
}

/**
 * Keep the local `profiles` row in sync with the auth provider's user record.
 * Called once per request so a freshly signed-up user always has a profile.
 */
export async function ensureProfile(payload) {
  const id = payload.sub || payload.id;
  if (!id) return null;

  const existing = await one("SELECT * FROM profiles WHERE id = $1", [id]);
  if (existing) {
    // Refresh name/email if the provider changed them.
    if (existing.email !== payload.email || existing.name !== payload.name) {
      return one(
        `UPDATE profiles SET email = $2, name = $3, updated_at = now() WHERE id = $1 RETURNING *`,
        [id, payload.email || existing.email, payload.name || existing.name],
      );
    }
    return existing;
  }

  return one(
    `INSERT INTO profiles (id, email, name) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, updated_at = now()
     RETURNING *`,
    [id, payload.email || "", payload.name || payload.email?.split("@")[0] || "Guest"],
  );
}

function extractBearer(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

/** Attaches req.userId / req.profile when a valid token is present; never rejects. */
export async function attachUser(req, _res, next) {
  try {
    const payload = await verifyToken(extractBearer(req));
    if (payload) {
      req.auth = payload;
      req.userId = payload.sub || payload.id;
      req.profile = await ensureProfile(payload);
    }
  } catch (error) {
    console.warn("attachUser error:", error.message);
  }
  next();
}

/** Rejects the request when no valid token is present. */
export function requireAuth(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

/** Rejects unless the authenticated user is flagged as an admin. */
export function requireAdmin(req, res, next) {
  if (!req.profile?.is_admin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export async function setAdmin(userId, isAdmin) {
  return query("UPDATE profiles SET is_admin = $2, updated_at = now() WHERE id = $1", [userId, isAdmin]);
}
