"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LANGUAGE } from "@/lib/ai/user-language";

const RTL_LANGS = new Set(["ar", "he"]);
const LS_KEY = "flowsmartly_lang";

/**
 * Client hook for the account's preferred language (single source of truth =
 * BrandKit.preferredLanguage). Optimistic: reflects the choice instantly,
 * caches in localStorage, and persists via PATCH /api/user/language. Because
 * the same field drives ALL AI output, switching here also switches every
 * future caption / design / video the agent produces.
 */
export function usePreferredLanguage() {
  const [language, setLanguageState] = useState<string>(DEFAULT_LANGUAGE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) setLanguageState(cached);
    } catch {}
    fetch("/api/user/language")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.success && typeof d.data?.language === "string") {
          setLanguageState(d.data.language);
          try { localStorage.setItem(LS_KEY, d.data.language); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const setLanguage = useCallback((tag: string) => {
    setLanguageState(tag);
    try { localStorage.setItem(LS_KEY, tag); } catch {}
    fetch("/api/user/language", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: tag }),
    }).catch(() => {});
  }, []);

  const dir: "rtl" | "ltr" = RTL_LANGS.has(language) ? "rtl" : "ltr";
  return { language, setLanguage, loading, dir };
}
