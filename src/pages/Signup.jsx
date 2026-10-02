import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import authService from "../services/auth";
import AuthShell from "../components/AuthShell";
import { login } from "../features/auth/authSlice";

export default function Signup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const authStatus = useSelector((state) => state.auth.status);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [step, setStep] = useState("form"); // "form" | "verify"
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (authStatus) {
      navigate("/", { replace: true });
    }
  }, [authStatus, navigate]);

  // Tick down the resend cooldown so we don't burn through Neon's per-endpoint
  // email rate limit (or spam the user) with repeated clicks.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSignup(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userData = await authService.signup({ email, password, name });
      if (!userData) throw new Error("Signup failed");

      // With "Verify at Sign-up" enabled, sign-up issues no session — the user has
      // to enter the emailed code first. With it disabled we get a session right
      // away and can continue exactly as before.
      if (!(await authService.hasSession())) {
        setStep("verify");
        setNotice(`We sent a verification code to ${email}.`);
        setCooldown(30);
        return;
      }

      await authService.login({ email, password });
      const user = await authService.getCurrentUser();

      if (user) {
        const isAdmin = await authService.checkIsAdmin();
        dispatch(login({ userData: user, isAdmin }));
      }
    } catch (err) {
      setError(err?.message || "Signup failed. Try a different email or stronger password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await authService.verifyEmailCode({ email, otp: code.trim() });

      if (await authService.hasSession()) {
        const user = await authService.getCurrentUser();
        if (user) {
          const isAdmin = await authService.checkIsAdmin();
          dispatch(login({ userData: user, isAdmin }));
          return;
        }
      }
      // Verified, but auto sign-in is off — send them to the login form.
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err?.message || "That code is not valid. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError("");
    setNotice("");
    setCooldown(30);
    try {
      await authService.resendVerificationEmail(email);
      setNotice(`A new code is on its way to ${email}.`);
    } catch (err) {
      setError(err?.message || "Could not resend the code.");
      setCooldown(0);
    }
  }

  const feedback = (
    <>
      {error ? (
        <div className="rounded-[22px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-[22px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}
    </>
  );

  if (step === "verify") {
    return (
      <AuthShell
        eyebrow="Verify your email"
        title="Enter your code"
        description={`We sent a code to ${email}. It expires after 15 minutes.`}
        footerText="Wrong email?"
        footerLink="/signup"
        footerLabel="Start over"
      >
        <form onSubmit={handleVerify} className="space-y-4">
          {feedback}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-300">Verification code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              className="w-full rounded-[22px] border border-white/10 bg-black/35 px-4 py-3 text-center text-lg tracking-[0.4em] text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold !text-zinc-950 transition hover:bg-zinc-200 hover:!text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify email"}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={loading || cooldown > 0}
            className="w-full rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Join GoodPost"
      title="Create your account"
      description="Set up your profile and start sharing photos, captions, and audio posts."
      footerText="Already have an account?"
      footerLink="/login"
      footerLabel="Sign in"
    >
      <form onSubmit={handleSignup} className="space-y-4">
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

        {feedback}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-300">Name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your display name"
            className="w-full rounded-[22px] border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
            required
          />
        </label>

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
            placeholder="Create a password"
            className="w-full rounded-[22px] border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold !text-zinc-950 transition hover:bg-zinc-200 hover:!text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
