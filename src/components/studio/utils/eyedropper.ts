"use client";

/**
 * Wrapper around the browser EyeDropper API. Returns the picked color as a
 * hex string (#rrggbb), or null if the user cancelled or the API is unavailable.
 *
 * Browser support (2026): Chromium-based desktop only. Returns null in
 * Firefox/Safari/mobile so callers can fall back to manual color input.
 */
export async function pickScreenColor(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const W = window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };
  if (!W.EyeDropper) return null;
  try {
    const dropper = new W.EyeDropper();
    const result = await dropper.open();
    return result.sRGBHex || null;
  } catch {
    // User cancelled (Esc) or permission denied
    return null;
  }
}

export function isEyeDropperSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { EyeDropper?: unknown }).EyeDropper);
}
