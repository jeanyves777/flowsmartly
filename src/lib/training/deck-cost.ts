/**
 * Client-side estimate for the AI presentation — mirrors the server charge basis in
 * `api/ai/training/[id]/deck/route.ts` (charge the max, refund the unused part). What
 * the brief shows is an ESTIMATE; the exact charge is metered server-side. It also
 * derives the "AI build preview" numbers so they track the actual selections rather
 * than being invented. [[training-studio]]
 */
export const DECK_BASE_CREDITS = 12;
export const DECK_IMAGE_CREDITS = 15;

export interface DeckWants {
  slides: boolean;
  photos: boolean;
  threeD: boolean;
  livedraw: boolean;
  whiteboard: boolean;
  notes: boolean;
}

/** Slides we aim for from a spoken duration (~one teaching moment per 6 minutes). */
export function slideCountForDuration(durationMins: number): number {
  return Math.min(12, Math.max(3, Math.round(durationMins / 6)));
}

export interface DeckPreview {
  moments: number;
  reveals: number;
  photos: number;
  threeD: number;
  livedraw: number;
  practice: number;
  images: number;
  estCredits: number;
}

/** A plausible build preview + credit estimate from the duration and what AI builds. */
export function deckPreview(durationMins: number, w: DeckWants): DeckPreview {
  const moments = slideCountForDuration(durationMins);
  const visualDocs = w.slides ? Math.round(moments * 0.6) : 0;
  const photos = w.photos ? Math.max(1, Math.round(visualDocs * 0.5)) : 0;
  const threeD = w.threeD ? Math.max(1, Math.round(visualDocs * 0.4)) : 0;
  const boardish = w.whiteboard || w.livedraw ? Math.max(1, Math.round(moments * 0.3)) : 0;
  const livedraw = w.livedraw ? Math.min(2, Math.max(1, boardish)) : 0;
  const reveals = Math.round(moments * 1.7) + boardish;
  const images = photos + threeD;
  const estCredits = DECK_BASE_CREDITS + images * DECK_IMAGE_CREDITS;
  return { moments, reveals, photos, threeD, livedraw, practice: w.slides || boardish ? 1 : 0, images, estCredits };
}
