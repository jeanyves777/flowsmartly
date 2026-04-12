"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Turnstile } from "@marsidev/react-turnstile";

export default function StoreLoginPage() {
  const { slug } = useParams<{ slug: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (!turnstileToken) {
      setError("Please complete the verification.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/store/${slug}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed. Please try again.");
        setLoading(false);
        return;
      }

      window.location.href = `/store/${slug}/account`;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4 py-12">
      <div
        className="w-full max-w-md rounded-xl border p-6 sm:p-8"
        style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
      >
        <h1
          className="text-2xl font-bold text-center mb-1"
          style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
        >
          Sign In
        </h1>
        <p className="text-sm text-center opacity-50 mb-6">
          Access your account to track orders and more
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)",
                backgroundColor: "var(--store-input-bg, var(--store-background))",
                "--tw-ring-color": "var(--store-primary)",
              } as React.CSSProperties}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 pr-10"
                style={{
                  borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)",
                  backgroundColor: "var(--store-input-bg, var(--store-background))",
                  "--tw-ring-color": "var(--store-primary)",
                } as React.CSSProperties}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70"
              >
                {showPassword ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
              onSuccess={setTurnstileToken}
              onError={() => setTurnstileToken("")}
              onExpire={() => setTurnstileToken("")}
            />
          </div>

          <button
            type="submit"
            disabled={loading || (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken)}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Google OAuth */}
        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px" style={{ backgroundColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }} />
          <span className="text-xs opacity-40">or</span>
          <div className="flex-1 h-px" style={{ backgroundColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }} />
        </div>

        <a
          href={(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || turnstileToken) ? `/api/store-auth/google?storeSlug=${slug}&callbackUrl=/store/${slug}/account` : undefined}
          onClick={(e) => { if (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) e.preventDefault(); }}
          className={`flex items-center justify-center gap-2 w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"}`}
          style={{ borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)" }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </a>

        <p className="mt-6 text-center text-sm opacity-50">
          Don&apos;t have an account?{" "}
          <Link
            href={`/store/${slug}/account/register`}
            className="font-medium hover:underline"
            style={{ color: "var(--store-primary)" }}
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
