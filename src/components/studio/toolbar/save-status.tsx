"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { useCanvasStore } from "../hooks/use-canvas-store";

/**
 * Tiny autosave indicator for the top toolbar. States:
 *
 *   "Saving..."         — isSaving=true (overrides everything)
 *   "Unsaved changes"   — isDirty=true and not currently saving
 *   "Saved Xs ago"      — last save was within the last 60s
 *   "Saved Xm ago"      — last save 1-59 minutes ago
 *   "All changes saved" — fallback when there's a save timestamp but no
 *                         meaningful "ago" to render (e.g. fresh load)
 *   nothing             — never been saved AND not dirty
 *
 * Re-renders every 30s while there's a `lastSavedAt` so the relative time
 * stays roughly accurate without busy-looping.
 */
export function SaveStatus() {
  const isSaving = useCanvasStore((s) => s.isSaving);
  const isDirty = useCanvasStore((s) => s.isDirty);
  const lastSavedAt = useCanvasStore((s) => s.lastSavedAt);

  // Tick every 30s so "Saved 5s ago" → "Saved 35s ago" → "Saved 1m ago"
  // updates without other state changes triggering it.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  if (isSaving) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Saving…</span>
      </div>
    );
  }

  if (isDirty) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400"
        role="status"
        aria-live="polite"
        title="Auto-save runs after 30s of inactivity, or you can press Ctrl+S now."
      >
        <AlertCircle className="h-3 w-3" />
        <span>Unsaved</span>
      </div>
    );
  }

  if (!lastSavedAt) return null;

  const seconds = Math.max(1, Math.round((Date.now() - lastSavedAt) / 1000));
  let label: string;
  if (seconds < 60) label = `Saved ${seconds}s ago`;
  else if (seconds < 3600) label = `Saved ${Math.round(seconds / 60)}m ago`;
  else label = "All changes saved";

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
      <span>{label}</span>
    </div>
  );
}
