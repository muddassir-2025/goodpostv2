import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import authService from "../appwrite/auth";
import AuthShell from "../components/AuthShell";
import { login } from "../features/auth/authSlice";

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const authStatus = useSelector((state) => state.auth.status);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const destination = location.state?.from || "/";

  useEffect(() => {
    if (authStatus) {
      navigate(destination, { replace: true });
    }
  }, [authStatus, destination, navigate]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const session = await authService.login({ email, password });

      if (session) {
        const user = await authService.getCurrentUser();
        if (user) {
          const isAdmin = await authService.checkIsAdmin();
          dispatch(login({ userData: user, isAdmin }));
        }
      }
    } catch {
      setError("Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      description="Jump back into your feed, your saved posts, and the composer."
      footerText="Need an account?"
      footerLink="/signup"
      footerLabel="Create one"
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <button
          type="button"
          onClick={() => authService.googleAuth()}
          className="w-full flex items-center justify-center gap-2 rounded-full border border-white/20 bg-transparent px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 py-2">
          <div className="h-px w-full bg-white/10" />
          <span className="text-xs uppercase text-zinc-500">Or</span>
          <div className="h-px w-full bg-white/10" />
        </div>

        {error ? (
          <div className="rounded-[22px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-300">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-[22px] border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-300">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className="w-full rounded-[22px] border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold !text-zinc-950 transition hover:bg-zinc-200 hover:!text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
