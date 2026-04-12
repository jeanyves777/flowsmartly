"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function CompleteProfilePage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/store/${slug}/account/profile`)
      .then((r) => r.json())
      .then((data) => {
        setName(data.customer?.name || "");
        setPhone(data.customer?.phone || "");
        setEmail(data.customer?.email || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/store/${slug}/account/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), profileComplete: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save profile.");
        return;
      }

      // Hard navigate so SSR re-reads the updated profileComplete flag
      window.location.href = `/store/${slug}/account`;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)",
    backgroundColor: "var(--store-input-bg, var(--store-background))",
    "--tw-ring-color": "var(--store-primary)",
  } as React.CSSProperties;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 px-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent"
          style={{ color: "var(--store-primary)" }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4 text-white"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
          >
            Complete Your Profile
          </h1>
          <p className="mt-2 text-sm opacity-60">
            Just a few more details to finish setting up your account.
          </p>
        </div>

        <div
          className="rounded-xl border p-6 sm:p-8"
          style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
        >
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full rounded-lg border px-3 py-2.5 text-sm opacity-50 cursor-not-allowed"
                style={inputStyle}
              />
              <p className="text-xs opacity-40 mt-1">Signed in with Google</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={inputStyle}
                placeholder="John Doe"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Phone Number *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={inputStyle}
                placeholder="+1 (555) 000-0000"
                autoComplete="tel"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--store-primary)" }}
            >
              {saving ? "Saving..." : "Complete Setup"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
