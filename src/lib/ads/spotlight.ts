export const PREMIER_SPOTLIGHT_CHANNEL_ID = "spotlight";
export const PREMIER_SPOTLIGHT_FEE_CREDITS = 35;
export const SYSTEM_PREMIER_SPOTLIGHT_FLAG = "systemPremierSpotlight";

export function isVideoLikeUrl(value?: string | null): boolean {
  if (!value) return false;
  const clean = value.split("?")[0].split("#")[0].toLowerCase();
  return /\.(mp4|webm|mov|m4v)$/.test(clean) || clean.includes("/video/");
}

export function parseAdTargeting(value?: string | null | Record<string, unknown>): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function getTargetingChannelIds(value?: string | null | Record<string, unknown>): string[] {
  const parsed = parseAdTargeting(value);
  const providers = Array.isArray(parsed.providers) ? parsed.providers : [];
  const placementChannels = Array.isArray(parsed.placementChannels) ? parsed.placementChannels : [];
  return Array.from(
    new Set(
      [...providers, ...placementChannels]
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.toLowerCase())
    )
  );
}

export function targetingRequestsSpotlight(value?: string | null | Record<string, unknown>): boolean {
  return getTargetingChannelIds(value).includes(PREMIER_SPOTLIGHT_CHANNEL_ID);
}

export function getSpotlightFeeCredits(value?: string | null | Record<string, unknown>): number {
  return targetingRequestsSpotlight(value) ? PREMIER_SPOTLIGHT_FEE_CREDITS : 0;
}

export function buildSystemSpotlightTargeting(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    providers: ["feed", PREMIER_SPOTLIGHT_CHANNEL_ID],
    placementChannels: ["feed", PREMIER_SPOTLIGHT_CHANNEL_ID],
    [SYSTEM_PREMIER_SPOTLIGHT_FLAG]: true,
    source: "flowsmartly_premier",
    ...extra,
  };
}
