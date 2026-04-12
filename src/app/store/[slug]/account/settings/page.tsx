"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function StoreSettingsPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch(`/api/store/${slug}/account/profile`);
      if (res.status === 401) {
        router.push(`/store/${slug}/account/login`);
        return;
      }
      const data = await res.json();
      setName(data.name || "");
      setPhone(data.phone || "");
      setEmail(data.email || "");
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg("");
    setProfileError("");

    if (!name.trim()) {
      setProfileError("Name is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/store/${slug}/account/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });

      if (res.status === 401) {
        router.push(`/store/${slug}/account/login`);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setProfileError(data.error || "Failed to update profile.");
        return;
      }

      setProfileMsg("Profile updated successfully.");
    } catch {
      setProfileError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg("");
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError("Please fill in all password fields.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`/api/store/${slug}/account/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.status === 401) {
        router.push(`/store/${slug}/account/login`);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setPasswordError(data.error || "Failed to change password.");
        return;
      }

      setPasswordMsg("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch {
      setPasswordError("Something went wrong.");
    } finally {
      setSavingPassword(false);
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
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/store/${slug}/account`}
          className="opacity-50 hover:opacity-80 transition-opacity"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
        >
          Account Settings
        </h1>
      </div>

      <div className="space-y-8">
        {/* Profile Section */}
        <div
          className="rounded-lg border p-5 sm:p-6"
          style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
        >
          <h2 className="text-lg font-semibold mb-4">Profile</h2>

          {profileMsg && (
            <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
              {profileMsg}
            </div>
          )}
          {profileError && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {profileError}
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full rounded-lg border px-3 py-2.5 text-sm opacity-50 cursor-not-allowed"
                style={inputStyle}
              />
              <p className="text-xs opacity-40 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--store-primary)" }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div
          className="rounded-lg border p-5 sm:p-6"
          style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
        >
          <h2 className="text-lg font-semibold mb-4">Change Password</h2>

          {passwordMsg && (
            <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
              {passwordMsg}
            </div>
          )}
          {passwordError && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {passwordError}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={inputStyle}
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={inputStyle}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={inputStyle}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--store-primary)" }}
            >
              {savingPassword ? "Changing..." : "Change Password"}
            </button>
          </form>
        </div>

        {/* Logout */}
        <div
          className="rounded-lg border p-5 sm:p-6"
          style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
        >
          <h2 className="text-lg font-semibold mb-2">Sign Out</h2>
          <p className="text-sm opacity-50 mb-4">
            You will need to sign in again to access your account.
          </p>
          <form action={`/api/store/${slug}/auth/logout`} method="POST">
            <button
              type="submit"
              className="rounded-lg border border-red-300 dark:border-red-700 px-5 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 transition-opacity hover:opacity-80"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
