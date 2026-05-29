"use client";

import { SPEECH_LOCALES } from "./voice-lang";
import { cn } from "@/lib/utils/cn";

/**
 * Compact dictation-language selector shown next to the voice buttons.
 * Sets which language the browser speech recognizer listens for, so the user
 * can switch (e.g. to French) and get accurate transcription.
 */
export function VoiceLangPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Voice input language"
      title="Voice input language — set this to the language you'll speak"
      className={cn(
        "h-9 w-[3.25rem] rounded-md border border-border bg-transparent px-1 text-center text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer",
        className,
      )}
    >
      {SPEECH_LOCALES.map((l) => (
        <option key={l.code} value={l.code} title={l.label}>
          {abbr(l.code)}
        </option>
      ))}
    </select>
  );
}

/** "en-US" -> "EN", "pt-BR" -> "PT", "zh-CN" -> "ZH". */
function abbr(code: string): string {
  return code.split("-")[0].toUpperCase();
}
