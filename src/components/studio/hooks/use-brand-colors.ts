"use client";

import { useEffect, useState } from "react";

/**
 * Fetches the user's brand-kit colors once per session and caches them
 * at module scope so every ColorInput instance shares the same payload
 * without spawning duplicate network requests.
 *
 * Returns the deduped, hex-formatted colors in a stable order
 * (primary, secondary, accent, then any extras alphabetically).
 */

let cache: string[] | null = null;
let inflight: Promise<string[]> | null = null;

const PREFERRED_KEY_ORDER = ["primary", "secondary", "accent"];

function normalizeHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    // Expand #rgb → #rrggbb
    return ("#" + v.slice(1).split("").map((c) => c + c).join("")).toLowerCase();
  }
  return null;
}

async function fetchOnce(): Promise<string[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/brand");
      if (!res.ok) {
        cache = [];
        return cache;
      }
      const data = await res.json();
      const kit = data?.data?.brandKit;
      if (!kit) {
        cache = [];
        return cache;
      }
      const colorsRaw = typeof kit.colors === "string" ? JSON.parse(kit.colors || "{}") : kit.colors || {};
      if (!colorsRaw || typeof colorsRaw !== "object") {
        cache = [];
        return cache;
      }

      // Sort keys: preferred order first, then alphabetical for the rest.
      const allKeys = Object.keys(colorsRaw);
      const preferred = PREFERRED_KEY_ORDER.filter((k) => allKeys.includes(k));
      const extras = allKeys
        .filter((k) => !PREFERRED_KEY_ORDER.includes(k))
        .sort();
      const ordered = [...preferred, ...extras];

      const seen = new Set<string>();
      const result: string[] = [];
      for (const k of ordered) {
        const hex = normalizeHex(colorsRaw[k]);
        if (hex && !seen.has(hex)) {
          seen.add(hex);
          result.push(hex);
        }
      }
      cache = result;
      return cache;
    } catch {
      cache = [];
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useBrandColors(): string[] {
  const [colors, setColors] = useState<string[]>(cache ?? []);
  useEffect(() => {
    let cancelled = false;
    fetchOnce().then((c) => {
      if (!cancelled) setColors(c);
    });
    return () => { cancelled = true; };
  }, []);
  return colors;
}

/** Force the cache to refresh on next access — useful after the user updates their brand kit. */
export function invalidateBrandColorsCache(): void {
  cache = null;
  inflight = null;
}
