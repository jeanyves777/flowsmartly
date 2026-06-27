"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Sun, Contrast, Moon, LogOut } from "lucide-react";
import { LanguageSwitcher } from "../language-switcher";
import { cn } from "@/lib/utils/cn";

const THEMES = [
  { k: "light", label: "Light", Icon: Sun },
  { k: "grey", label: "Grey", Icon: Contrast },
  { k: "dark", label: "Dark", Icon: Moon },
] as const;

/**
 * Account & settings, reinvented in the NEW design (a focused-view canvas) — no
 * legacy links. Profile summary + appearance (theme / language) + account
 * actions. Deeper settings get reinvented here over time; meanwhile the agent on
 * the left handles anything else. See [[new-design-no-legacy]].
 */
export function FocusedAccount({
  user,
  language,
  onLanguage,
  onLogout,
}: {
  user: { name: string; email: string | null; initials: string; avatarUrl: string | null };
  language: string;
  onLanguage: (tag: string) => void;
  onLogout: () => void;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active = !mounted ? "dark" : theme === "system" ? resolvedTheme ?? "light" : theme ?? "light";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Profile */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 to-violet-500 text-[18px] font-bold text-white">
              {user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={56} height={56} className="h-full w-full object-cover" unoptimized /> : user.initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[17px] font-bold">{user.name}</div>
              {user.email && <div className="truncate text-[13px] text-muted-foreground">{user.email}</div>}
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Appearance</h3>
          <p className="mt-2 text-[12.5px] font-medium">Theme</p>
          <div className="mt-2 grid grid-cols-3 gap-2.5">
            {THEMES.map(({ k, label, Icon }) => (
              <button
                key={k}
                onClick={() => setTheme(k)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition",
                  mounted && active === k ? "border-brand-500 bg-brand-500/5" : "border-transparent bg-muted/50 hover:bg-muted",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[12px] font-medium">{label}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium">Language</p>
              <p className="text-[11.5px] text-muted-foreground">Switches the UI and all AI output.</p>
            </div>
            <LanguageSwitcher language={language} onChange={onLanguage} />
          </div>
        </section>

        {/* Account */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account</h3>
          <button
            onClick={onLogout}
            className="mt-2.5 inline-flex items-center gap-2 rounded-[10px] border border-border px-3.5 py-2 text-[13px] font-semibold text-destructive transition hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
          <p className="mt-3 text-[11.5px] leading-snug text-muted-foreground">More settings (security, billing, connections) are being reinvented in the new design — ask the agent on the left for anything you need meanwhile.</p>
        </section>
      </div>
    </div>
  );
}
