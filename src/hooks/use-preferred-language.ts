"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LANGUAGE, isSupportedLanguage } from "@/lib/ai/user-language";

const RTL_LANGS = new Set(["ar", "he"]);
const LS_KEY = "flowsmartly_lang";

/**
 * Auto-detect the user's language from the browser's locale settings (which
 * reflect their region/device language — geo-detect without an IP service).
 * Matches an exact tag first (pt-BR, zh-TW), then the base (fr-FR → fr).
 */
function detectBrowserLanguage(): string | null {
  if (typeof navigator === "undefined") return null;
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]).filter(
    (l): l is string => typeof l === "string" && l.length > 0,
  );
  for (const raw of list) {
    if (isSupportedLanguage(raw)) return raw;
    const base = raw.split("-")[0];
    if (isSupportedLanguage(base)) return base;
  }
  return null;
}

/**
 * Client hook for the account's preferred language (single source of truth =
 * BrandKit.preferredLanguage). Resolution order on first load:
 *   1. this device's saved choice (localStorage)
 *   2. the account's explicitly-set server preference
 *   3. browser/geo locale auto-detect
 *   4. English
 * Switching here also switches every future AI output (same DB field).
 */
export function usePreferredLanguage() {
  const [language, setLanguageState] = useState<string>(DEFAULT_LANGUAGE);
  const [loading, setLoading] = useState(true);

  const persist = useCallback((tag: string) => {
    try { localStorage.setItem(LS_KEY, tag); } catch {}
    fetch("/api/user/language", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: tag }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    let cached: string | null = null;
    try { cached = localStorage.getItem(LS_KEY); } catch {}
    // A saved choice on this device wins — don't re-detect over the user's pick.
    if (cached) {
      setLanguageState(cached);
      setLoading(false);
      return () => { alive = false; };
    }
    // No saved choice yet → server preference, else geo/locale auto-detect.
    fetch("/api/user/language")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const server = d?.success && typeof d.data?.language === "string" ? d.data.language : null;
        let chosen = server && server !== DEFAULT_LANGUAGE && isSupportedLanguage(server) ? server : null;
        if (!chosen) chosen = detectBrowserLanguage();
        if (chosen && chosen !== DEFAULT_LANGUAGE) {
          setLanguageState(chosen);
          persist(chosen);
        }
      })
      .catch(() => {
        if (!alive) return;
        const detected = detectBrowserLanguage();
        if (detected && detected !== DEFAULT_LANGUAGE) {
          setLanguageState(detected);
          persist(detected);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [persist]);

  const setLanguage = useCallback((tag: string) => {
    setLanguageState(tag);
    persist(tag);
  }, [persist]);

  const dir: "rtl" | "ltr" = RTL_LANGS.has(language) ? "rtl" : "ltr";
  return { language, setLanguage, loading, dir };
}
