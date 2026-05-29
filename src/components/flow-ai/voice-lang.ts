"use client";

import { useEffect, useState } from "react";

/**
 * The browser Web Speech API does NOT auto-detect language — recognition.lang
 * must be set to the language being spoken, or it mis-transcribes (e.g. French
 * spoken into an en-US recognizer comes out as English gibberish). So we let
 * the user pick their dictation language; it persists across sessions.
 */
export const SPEECH_LOCALES: Array<{ code: string; label: string }> = [
  { code: "en-US", label: "English" },
  { code: "fr-FR", label: "Français" },
  { code: "es-ES", label: "Español" },
  { code: "pt-BR", label: "Português" },
  { code: "de-DE", label: "Deutsch" },
  { code: "it-IT", label: "Italiano" },
  { code: "nl-NL", label: "Nederlands" },
  { code: "pl-PL", label: "Polski" },
  { code: "ru-RU", label: "Русский" },
  { code: "tr-TR", label: "Türkçe" },
  { code: "ar-SA", label: "العربية" },
  { code: "zh-CN", label: "中文" },
  { code: "ja-JP", label: "日本語" },
  { code: "ko-KR", label: "한국어" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "id-ID", label: "Bahasa Indonesia" },
  { code: "vi-VN", label: "Tiếng Việt" },
];

const STORAGE_KEY = "flow-ai-voice-lang";

function detectDefault(): string {
  if (typeof navigator === "undefined") return "en-US";
  const nav = navigator.language || "en-US";
  if (SPEECH_LOCALES.some((l) => l.code === nav)) return nav;
  const base = nav.split("-")[0];
  return SPEECH_LOCALES.find((l) => l.code.split("-")[0] === base)?.code || "en-US";
}

/** Persisted dictation language. Defaults to the browser locale (matched to
 * our list), overridable by the user via VoiceLangPicker. */
export function useVoiceLang(): [string, (v: string) => void] {
  const [lang, setLangState] = useState("en-US");
  useEffect(() => {
    try {
      setLangState(localStorage.getItem(STORAGE_KEY) || detectDefault());
    } catch {
      setLangState(detectDefault());
    }
  }, []);
  const setLang = (v: string) => {
    setLangState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  };
  return [lang, setLang];
}
