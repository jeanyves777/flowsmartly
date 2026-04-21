"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the most-recently-used colors across all ColorInput instances in
 * a single studio session. Recents persist to localStorage so they survive
 * page reloads but are deliberately *not* shared across browsers/devices —
 * this is a working scratchpad, not user content.
 *
 * The list is capped at MAX_RECENTS, deduped (case-insensitive), and
 * ordered MRU-first. A pub/sub keeps every subscribed component in sync
 * without a re-render cascade through the canvas store.
 */

const MAX_RECENTS = 12;
const STORAGE_KEY = "flowsmartly:studio:recent-colors";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

let cache: string[] = [];
let loaded = false;
const subscribers = new Set<(colors: string[]) => void>();

function loadFromStorage(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      cache = parsed.filter((c) => typeof c === "string" && HEX_RE.test(c)).slice(0, MAX_RECENTS);
    }
  } catch {
    // ignore — recents are best-effort
  }
}

function persistToStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // quota exceeded etc. — recents stay in-memory only
  }
}

function notify(): void {
  // Snapshot to avoid mutation surprises mid-iteration
  const snapshot = [...cache];
  subscribers.forEach((cb) => cb(snapshot));
}

/** Push a color to the front of the recents list, deduped. */
export function pushRecentColor(hex: string): void {
  if (!hex || !HEX_RE.test(hex)) return;
  loadFromStorage();
  const lower = hex.toLowerCase();
  const without = cache.filter((c) => c.toLowerCase() !== lower);
  cache = [lower, ...without].slice(0, MAX_RECENTS);
  persistToStorage();
  notify();
}

/** Subscribe to the live recents list — returns the current snapshot. */
export function useRecentColors(): string[] {
  loadFromStorage();
  const [colors, setColors] = useState<string[]>(cache);
  useEffect(() => {
    const cb = (next: string[]) => setColors(next);
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }, []);
  return colors;
}

/** For tests / "clear recents" actions. */
export function clearRecentColors(): void {
  cache = [];
  persistToStorage();
  notify();
}
