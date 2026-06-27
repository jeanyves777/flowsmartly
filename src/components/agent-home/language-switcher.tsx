"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { SUPPORTED_LANGUAGES, getLanguageLabel } from "@/lib/ai/user-language";
import { cn } from "@/lib/utils/cn";

/**
 * Language switcher over the real SUPPORTED_LANGUAGES. Selecting a language
 * switches the UI chrome AND every future AI output (single source of truth =
 * BrandKit.preferredLanguage). RTL languages flip the whole home layout.
 */
export function LanguageSwitcher({
  language,
  onChange,
}: {
  language: string;
  onChange: (tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={getLanguageLabel(language)}
        aria-label="Language"
        className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-brand-500/60 hover:text-foreground"
      >
        <Globe className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-80 w-56 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-1.5 shadow-xl">
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.tag}
              type="button"
              onClick={() => {
                onChange(l.tag);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted",
                l.tag === language && "bg-brand-500/10 text-brand-500",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{l.nativeLabel}</span>
              {l.tag === language ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <span className="shrink-0 text-[10px] uppercase text-muted-foreground">{l.tag}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
