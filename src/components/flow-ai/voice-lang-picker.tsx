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
        "h-9 max-w-[6.5rem] rounded-md border border-border bg-transparent px-1.5 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer",
        className,
      )}
    >
      {SPEECH_LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
