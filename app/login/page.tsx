"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/shared";
import { isApiError } from "@/lib/shared";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      // The admin portal is AGENCY_ADMIN-only. A vendor/driver login authenticates fine against
      // the shared backend, so reject it here and drop the session rather than let them in.
      if (user && user.role !== "AGENCY_ADMIN") {
        await logout();
        setError("This account is not an agency admin. Vendor accounts must use the vendor portal.");
        return;
      }
      router.replace("/");
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fieldCls =
    "w-full h-11 px-3.5 bg-white border border-border rounded-lg text-text-primary text-sm placeholder:text-text-tertiary hover:border-[#C2C7CF] transition-[border-color,box-shadow] focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue";

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-ops-bg">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white bg-[linear-gradient(160deg,#0A3470_0%,#072D62_50%,#04204A_100%)]">
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-[radial-gradient(circle,rgba(179,150,97,0.28)_0%,transparent_65%)] animate-float-slow" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 w-[32rem] h-[32rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.09)_0%,transparent_65%)] animate-float-slow" style={{ animationDelay: "-4s" }} />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <span className="font-serif text-2xl leading-none text-accent-gold">R</span>
          </span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/60">Rezolv</span>
        </div>
        <div className="relative max-w-md animate-rise-in">
          <h1 className="display-serif text-7xl tracking-tight">RIDE</h1>
          <div className="mt-5 h-px w-16 bg-accent-gold" />
          <p className="mt-5 font-serif text-2xl font-normal leading-snug text-white/85">
            Every trip, every vehicle, every vendor &mdash; one calm control room.
          </p>
        </div>
        <p className="relative text-[11px] uppercase tracking-[0.18em] text-white/40">Rezolv Integrated Dispatch Engine</p>
      </aside>

      <div className="relative flex items-center justify-center px-4 py-10 overflow-hidden bg-ops-grid">
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 w-96 h-96 rounded-full bg-accent-gold/20 blur-3xl animate-float-slow lg:hidden" />
        <div className="relative w-full max-w-sm animate-rise-in">
          <div className="mb-8 text-center lg:hidden">
            <h1 className="display-serif text-5xl text-ops-sidebar tracking-tight">RIDE</h1>
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-secondary mt-2">Rezolv Integrated Dispatch Engine</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white/90 backdrop-blur rounded-2xl border border-border p-7 space-y-5 shadow-lift">
            <div>
              <h2 className="font-serif text-3xl font-medium tracking-tight text-text-primary">Welcome back</h2>
              <p className="text-sm text-text-secondary mt-1">Sign in to the agency console.</p>
            </div>

            {error && (
              <div role="alert" className="text-xs text-danger bg-danger-soft border border-danger/25 rounded-lg px-3 py-2.5 animate-fade-in">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-text-primary" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldCls}
                placeholder="operator@ride.local"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-text-primary" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${fieldCls} pr-11`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full h-11 px-4 inline-flex items-center justify-center gap-2 bg-gradient-to-b from-[#0E3F82] to-brand-blue text-white text-sm font-medium rounded-lg shadow-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] hover:brightness-110 hover:shadow-lift hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
