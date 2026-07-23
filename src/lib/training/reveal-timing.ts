// Pure, dependency-free reveal-timing helpers, shared by the CLIENT surfaces (live room +
// builder preview) and the server. They MUST live outside deck.ts: deck.ts pulls in the AI image
// client (undici / node:async_hooks), so importing anything from it into a client component drags
// server-only code into the browser bundle and breaks `next build`. [[training-presentation-animation]]
import type { DeckSlide } from "./types";

/** The reveal UNITS of a slide, in order — each appears on its own step: infographic cards, else
 *  bullets. Null when the slide has no per-step content (a single-reveal slide). */
export function slideRevealUnits(slide: Pick<DeckSlide, "infographic" | "bullets">): string[] | null {
  const cards = slide.infographic?.cards;
  if (cards && cards.length >= 2) return cards.map((c) => `${c.title || ""} ${c.desc || ""}`);
  if (slide.bullets && slide.bullets.length >= 2) return slide.bullets;
  return null;
}

/** Content-aware reveal timing: the FRACTION of the narration at which each unit should appear,
 *  spread in proportion to each unit's text length so a bullet the narrator dwells on stays up
 *  longer than a short one (vs an even 1/steps split that drifts out of sync). All reveals land in
 *  the first ~90% of the clip, leaving a closing beat. `frac[0] = 0` (first unit shows as the
 *  narration opens). Returns null for a single-reveal slide → the caller falls back to the even
 *  split. */
export function revealFractions(units: string[] | null | undefined, steps: number): number[] | null {
  if (!units) return null;
  const n = Math.min(units.length, Math.max(1, steps || units.length));
  if (n < 2) return null;
  const OUTRO = 0.1; // leave the last tenth of the clip as a closing breath
  const weights = units.slice(0, n).map((u) => Math.max(10, String(u).trim().length));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const fracs: number[] = [];
  let cum = 0;
  for (let k = 0; k < n; k++) { fracs.push((cum / total) * (1 - OUTRO)); cum += weights[k]; }
  return fracs;
}

/** How many reveal steps the narration has passed at fraction `frac` (0..1) of its playback, given
 *  per-step marks from `revealFractions`. Clamped to [1, cap]. */
export function revealStepAt(frac: number, fracs: number[], cap: number): number {
  let n = 0;
  for (const f of fracs) { if (frac >= f) n++; else break; }
  return Math.min(cap, Math.max(1, n));
}
