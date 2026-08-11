"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useLanguageStore, t } from "@/lib/shared";
import { Truck, Globe } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const { language, toggleLanguage } = useLanguageStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect from an effect, never from the render body. Calling router.push() while this
  // component renders updates the Router mid-render, which React reports as
  // "Cannot update a component (Router) while rendering a different component (LoginPage)".
  // `replace` (not `push`) so /login isn't left in history for the back button.
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  // The effect above is navigating; render nothing rather than flashing the login form.
  if (isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // replace, not push — otherwise the back button returns to the login form post-login.
      router.replace("/");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg">
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-border hover:bg-gray-50 transition-colors text-sm font-medium text-text-primary"
          title={t("toggleLanguage", language)}
        >
          <Globe className="w-4 h-4 text-text-muted" />
          <span>{language.toUpperCase()}</span>
        </button>
      </div>

      <div className="bg-card-bg rounded-xl shadow-lg border border-border p-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-sidebar-bg rounded-xl flex items-center justify-center mb-4">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="display-serif text-3xl text-text-primary tracking-tight text-center">{t("rideVendorPortal", language)}</h1>
          <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted mt-2">{t("signInManageFleet", language)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              placeholder="vendor@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 rounded-xl font-medium text-lg transition-all bg-sidebar-bg text-white hover:bg-sidebar-bg/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
