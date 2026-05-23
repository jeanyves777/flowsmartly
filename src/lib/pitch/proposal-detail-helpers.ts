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
