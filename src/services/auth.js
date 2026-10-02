import { authClient, getToken, clearTokenCache } from "../auth";
import { api } from "../api/client";

class AuthService {
  // Neon Auth (Managed Better Auth) has no "teams" concept; admin is a profile flag.
  async checkIsAdmin() {
    try {
      const user = await this.getCurrentUser();
      return Boolean(user?.isAdmin);
    } catch {
      return false;
    }
  }

  async signup({ email, password, name }) {
    const { data, error } = await authClient.signUp.email({ email, password, name });
    if (error) throw new Error(error.message || "Signup failed");
    // When the project requires verification, `emailVerified` is false and no
    // session is issued — the caller must run the code step before signing in.
    return data?.user || data;
  }

  /** Complete sign-up when "Verify at Sign-up" is enabled in Neon Console → Auth. */
  async verifyEmailCode({ email, otp }) {
    if (!authClient.emailOtp?.verifyEmail) {
      throw new Error("Email verification is not enabled for this project.");
    }
    const { data, error } = await authClient.emailOtp.verifyEmail({ email, otp });
    if (error) throw new Error(error.message || "That code is not valid.");
    clearTokenCache();
    return data;
  }

  /**
   * True when a Neon Auth session cookie is present. After sign-up this tells us
   * whether "Verify at Sign-up" is enforced: required verification issues no session.
   */
  async hasSession() {
    try {
      const { data } = await authClient.getSession();
      return Boolean(data?.session);
    } catch {
      return false;
    }
  }

  /**
   * Resend the sign-up code. Verification codes come from the email-OTP plugin, so
   * prefer that endpoint; projects configured for verification *links* reject it and
   * need the link-style call instead.
   */
  async resendVerificationEmail(email) {
    const otpResult = await authClient.emailOtp?.sendVerificationOtp?.({
      email,
      type: "email-verification",
    });
    if (otpResult && !otpResult.error) return;

    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/`,
    });
    if (error) {
      throw new Error(otpResult?.error?.message || error.message || "Could not resend the code.");
    }
  }

  async login({ email, password }) {
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) throw new Error(error.message || "Login failed");
    clearTokenCache();
    return data?.session || data;
  }

  async googleAuth() {
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/`,
    });
    if (error) throw new Error(error.message || "Google sign-in failed");
  }

  // Kept for App.jsx compatibility. Neon Auth completes the OAuth flow itself,
  // so there are no userId/secret params to exchange.
  async completeOAuth() {
    return null;
  }

  async getCurrentUser() {
    let session = null;
    try {
      const { data } = await authClient.getSession();
      session = data;
    } catch {
      session = null;
    }
    if (!session?.user) return null;

    // Prefer the profile row (bio, avatar, admin flag) from our API.
    try {
      const profile = await api.get("/api/users/me");
      if (profile) return profile;
    } catch {
      // fall through to the raw session user
    }

    return {
      $id: session.user.id,
      id: session.user.id,
      name: session.user.name || session.user.email?.split("@")[0] || "Guest",
      email: session.user.email,
      isAdmin: false,
      prefs: { bio: "", avatarId: null },
    };
  }

  async logout() {
    try {
      await authClient.signOut();
    } finally {
      clearTokenCache();
    }
  }

  async updateName(name) {
    return api.patch("/api/users/me/name", { name });
  }

  async updatePrefs(prefs) {
    return api.patch("/api/users/me", prefs);
  }

  async deleteAccount() {
    await api.delete("/api/users/me");
    await this.logout();
  }

  // Exposed so callers can await readiness before firing API calls.
  getToken() {
    return getToken();
  }
}

const authService = new AuthService();
export default authService;
