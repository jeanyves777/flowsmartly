"use client";

import { useEffect, useState } from "react";

/**
 * The viewport line the whole /home shell treats as mobile vs desktop is
 * Tailwind's `md` (768px): the mobile drawer, topbar buttons and the
 * FocusedView chat/canvas overlay all switch at `md`. Keep this in sync.
 */
export const MOBILE_QUERY = "(max-width: 767px)";

/** Synchronous check for use inside effects/handlers (no render subscription). */
export function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
}

/**
 * Subscribe to the mobile breakpoint. Starts `false` on the server / first
 * paint and corrects on mount, so use it for click-time decisions and
 * conditional rendering — for one-shot effects (e.g. auto-open-on-empty) prefer
 * `isMobileViewport()` read INSIDE the effect to avoid a first-render race.
 */
export function useIsMobile(query: string = MOBILE_QUERY): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return mobile;
}
