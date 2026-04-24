import { Client, ID, Account, Teams, OAuthProvider } from "appwrite";

class Authservice {
  client = new Client();
  account;
  teams;

  constructor() {
    this.client
      .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
      .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

    this.account = new Account(this.client);
    this.teams = new Teams(this.client);
  }

  /**
   * Check if the current user belongs to the 'admins' team.
   */
  async checkIsAdmin() {
    try {
      const response = await this.teams.list();
      // Returns true if user is in a team named 'admins' or with ID 'admins'
      return response.teams.some(
        (team) => 
          team.name.toLowerCase() === "admins" || 
          team.$id === "admins"
      );
    } catch (error) {
      return false;
    }
  }

  // 🔐 Signup
  async signup({ email, password, name }) {
    try {
      const user = await this.account.create(
        ID.unique(),
        email,
        password,
        name
      );
      return user;
    } catch (error) {
      console.error("signup error:", error);
      throw error;
    }
  }

  // 🔐 Login
  async login({ email, password }) {
    try {
      return await this.account.createEmailPasswordSession(
        email,
        password
      );
    } catch (error) {
      if (
        error?.code === 401 ||
        error?.type === "user_session_already_exists"
      ) {
        await this.logout();
        return await this.account.createEmailPasswordSession(
          email,
          password
        );
      }
      console.error("login error:", error);
      throw error;
    }
  }

  // 🌐 Google Auth (Using Token Flow for robust mobile/local testing)
  async googleAuth() {
    try {
      this.account.createOAuth2Token(
        OAuthProvider.Google,
        `${window.location.origin}/`,
        `${window.location.origin}/login?error=oauth_failed`
      );
    } catch (error) {
      console.error("google login error:", error);
      throw error;
    }
  }

  // 🔄 Complete OAuth Flow (called when redirect returns with tokens)
  async completeOAuth(userId, secret) {
    try {
      const session = await this.account.createSession(userId, secret);
      return session;
    } catch (error) {
      console.error("OAuth completion error:", error);
      throw error;
    }
  }

  // 👤 Current User
  async getCurrentUser() {
    try {
      return await this.account.get();
    } catch {
      return null;
    }
  }

  // 🚪 Logout
  async logout() {
    try {
      return await this.account.deleteSession("current");
    } catch (error) {
      console.error("logout error:", error);
      throw error;
    }
  }

  // 📝 Update Name
  async updateName(name) {
    try {
      return await this.account.updateName(name);
    } catch (error) {
      console.error("updateName error:", error);
      throw error;
    }
  }

  // 📝 Update Prefs (for bio, avatarId, etc.)
  async updatePrefs(prefs) {
    try {
      const currentPrefs = await this.account.getPrefs();
      return await this.account.updatePrefs({ ...currentPrefs, ...prefs });
    } catch (error) {
      console.error("updatePrefs error:", error);
      throw error;
    }
  }

  // 🗑️ Delete Account
  async deleteAccount() {
    try {

      // NOTE: Appwrite's Client SDK does not support deleting the user account directly for security.
      // This action usually requires a Server SDK or a Cloud Function.
      // For now, we will delete the current session to "log out" the user.
      return await this.account.deleteSession("current");
    } catch (error) {
      console.error("deleteAccount error:", error);
      throw error;
    }
  }
}

// singleton
const authService = new Authservice();
export default authService;