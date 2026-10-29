"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Contrast, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Shared theme picker — a dropdown (not a cycling button) so more themes can be
 * added later. Light / Grey ("lighter dark") / Dark. Uses next-themes.
 */
const THEMES = [
  { key: "light", label: "Light", icon: Sun },
  { key: "grey", label: "Grey", icon: Contrast },
  { key: "dark", label: "Dark", icon: Moon },
] as const;

export function ThemeMenu({ up = false, className }: { up?: boolean; className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const active = !mounted ? "dark" : theme === "system" ? resolvedTheme ?? "light" : theme ?? "light";
  const Current = (THEMES.find((t) => t.key === active) ?? THEMES[2]).icon;

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Theme"
        className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-brand-500/60 hover:text-foreground"
      >
        <Current className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <div
          className={cn(
            "absolute right-0 z-50 w-40 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl",
            up ? "bottom-full mb-2" : "mt-2",
          )}
        >
          {THEMES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTheme(t.key);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted",
                  mounted && active === t.key && "bg-brand-500/10 text-brand-500",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{t.label}</span>
                {mounted && active === t.key && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
