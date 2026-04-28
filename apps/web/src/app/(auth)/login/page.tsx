"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/admin";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(errorParam === "auth_callback_failed" ? "Authentication failed. Please try again." : "");
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [resetSent, setResetSent] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(redirect);
    });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.replace(redirect);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${redirect}` },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError("Enter your email address first."); return; }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/admin`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setResetSent(true);
  }

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-colors";
  const inputStyle = { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0d0d0d" }}>
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold mb-4 shadow-lg"
            style={{ background: "#a3e635", color: "#0d1a00" }}>
            IR
          </div>
          <div className="text-lg font-semibold text-white tracking-tight">Integrity Reforestation</div>
          <div className="text-xs font-medium mt-0.5 tracking-widest uppercase" style={{ color: "#a3e635" }}>
            Admin Console
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7" style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.1)" }}>

          {mode === "reset" ? (
            resetSent ? (
              <div className="text-center py-4">
                <div className="text-2xl mb-3">✉️</div>
                <div className="text-sm font-semibold text-white mb-1">Check your email</div>
                <div className="text-xs text-white/50">Password reset link sent to {email}</div>
                <button onClick={() => { setMode("login"); setResetSent(false); }}
                  className="mt-5 text-xs font-medium hover:underline"
                  style={{ color: "var(--color-primary, #a3e635)" }}>
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <div className="text-sm font-semibold text-white mb-1">Reset password</div>
                  <div className="text-xs text-white/40 mb-4">We&apos;ll send a reset link to your email.</div>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@integrity-reforestation.com" className={inputCls} style={inputStyle} required autoFocus />
                </div>
                {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                  style={{ background: "#a3e635", color: "#0d1a00" }}>
                  {loading ? "Sending…" : "Send reset link"}
                </button>
                <button type="button" onClick={() => { setMode("login"); setError(""); }}
                  className="w-full text-xs text-white/40 hover:text-white/70 transition-colors pt-1">
                  Back to sign in
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40 block mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@integrity-reforestation.com" className={inputCls} style={inputStyle} required autoFocus />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40 block mb-1.5">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" className={inputCls} style={inputStyle} required />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#a3e635", color: "#0d1a00" }}>
                {loading ? "Signing in…" : "Sign in"}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[10px] text-white/25 font-medium">or</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              {/* Google */}
              <button type="button" onClick={handleGoogleLogin} disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-medium border border-white/12 text-white/70 hover:bg-white/5 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 flex items-center justify-center gap-2.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="text-center pt-1">
                <button type="button" onClick={() => { setMode("reset"); setError(""); }}
                  className="text-xs text-white/35 hover:text-white/60 transition-colors">
                  Forgot password?
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-white/20 mt-6">
          Access is restricted to authorized Integrity Reforestation personnel.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
