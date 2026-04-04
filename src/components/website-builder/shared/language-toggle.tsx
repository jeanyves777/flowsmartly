"use client";

import { useState } from "react";
import { Globe } from "lucide-react";

interface LanguageToggleProps {
  languages: Array<{ code: string; label: string }>;
  currentLanguage: string;
  onLanguageChange: (code: string) => void;
}

const FLAG_MAP: Record<string, string> = {
  en: "🇺🇸", fr: "🇫🇷", es: "🇪🇸", de: "🇩🇪", it: "🇮🇹",
  pt: "🇧🇷", ar: "🇸🇦", zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷",
  ru: "🇷🇺", hi: "🇮🇳", nl: "🇳🇱", sv: "🇸🇪", tr: "🇹🇷",
};

export function LanguageToggle({ languages, currentLanguage, onLanguageChange }: LanguageToggleProps) {
  const [open, setOpen] = useState(false);

  if (languages.length <= 1) return null;

  const current = languages.find((l) => l.code === currentLanguage) || languages[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--wb-surface)] border border-[var(--wb-border)] text-sm hover:bg-[var(--wb-border)] transition-colors"
      >
        <span>{FLAG_MAP[current.code] || "🌐"}</span>
        <span className="text-[var(--wb-text)]">{current.label}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-[var(--wb-background)] border border-[var(--wb-border)] rounded-lg shadow-xl py-1 min-w-[140px] z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { onLanguageChange(lang.code); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--wb-surface)] transition-colors ${currentLanguage === lang.code ? "font-medium text-[var(--wb-primary)]" : "text-[var(--wb-text)]"}`}
            >
              <span>{FLAG_MAP[lang.code] || "🌐"}</span>
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
