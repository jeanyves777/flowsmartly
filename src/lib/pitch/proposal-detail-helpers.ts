import type { PitchContent } from "./pitch-detail-types";
import type { ServiceProposalContent } from "./proposal-agent";

export function isServiceProposalContent(
  content: PitchContent | Record<string, never> | null | undefined,
): content is ServiceProposalContent {
  return !!content && (content as ServiceProposalContent).documentType === "service_proposal";
}

export function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function getProposalTheme(proposal: ServiceProposalContent) {
  const snapshotColors = proposal.brandSnapshot?.colors as Record<string, string> | undefined;
  const designColors = proposal.design?.colorPalette || {};
  const primary = isHex(designColors.primary) ? designColors.primary : isHex(snapshotColors?.primary) ? snapshotColors.primary : "#0ea5e9";
  const secondary = isHex(designColors.secondary) ? designColors.secondary : isHex(snapshotColors?.secondary) ? snapshotColors.secondary : "#8b5cf6";
  const accent = isHex(designColors.accent) ? designColors.accent : isHex(snapshotColors?.accent) ? snapshotColors.accent : "#f59e0b";
  const bg = isHex(designColors.background) ? designColors.background : "#f8fafc";
  const ink = isHex(designColors.ink) ? designColors.ink : "#0f172a";
  return { primary, secondary, accent, bg, ink };
}

export type ProposalTheme = ReturnType<typeof getProposalTheme>;

/** Relative luminance (0 = black … 1 = white) of a #rrggbb colour. */
export function colorLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const chan = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * chan((n >> 16) & 255) + 0.7152 * chan((n >> 8) & 255) + 0.0722 * chan(n & 255);
}

function rgbHex(r: number, g: number, b: number): string {
  const h = (c: number) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Darken a brand colour just enough that it reads clearly on a WHITE surface
 * (as a fill, border, or small text). Colours that are already dark enough are
 * returned unchanged — so dark brands are unaffected — while pale colours (a
 * near-white or pastel accent, say) are stepped down, keeping their hue, until
 * they are visible. Prevents a light accent-coloured metric ring / pill from
 * disappearing against the white proposal.
 */
export function visibleOnWhite(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return isHex(hex) ? hex : "#334155";
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  let guard = 0;
  while (colorLuminance(rgbHex(r, g, b)) > 0.5 && guard++ < 16) {
    r *= 0.82; g *= 0.82; b *= 0.82;
  }
  return rgbHex(r, g, b);
}

/** Pick ink or white text for legibility on a given background colour. */
export function textOnColor(bgHex: string, ink = "#0f172a"): string {
  return colorLuminance(bgHex) > 0.55 ? ink : "#ffffff";
}

export function cloneContent<T>(content: T): T {
  return JSON.parse(JSON.stringify(content || {})) as T;
}

export function normalizeLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function decodeEntities(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function moneyLabel(value: number | undefined) {
  return typeof value === "number" ? `$${value.toLocaleString()}` : "Custom";
}
