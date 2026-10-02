import { createAuthClient } from "@neondatabase/neon-js/auth";

export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  // The SPA runs on a different origin than the Neon Auth service, so the
  // session cookie must be sent cross-origin for token() to succeed.
  fetchOptions: { credentials: "include" },
});

function decodeExpiry(token) {
  try {
    const [, payload] = token.split(".");
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json.exp ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

let cached = { token: null, expiresAt: 0 };

/** Return a valid Neon Auth JWT, refreshing shortly before it expires. */
export async function getToken() {
  if (cached.token && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }
  try {
    const { data, error } = await authClient.token();
    if (error || !data?.token) return null;
    cached = { token: data.token, expiresAt: decodeExpiry(data.token) || Date.now() + 10 * 60_000 };
    return cached.token;
  } catch {
    return null;
  }
}

export function clearTokenCache() {
  cached = { token: null, expiresAt: 0 };
}
