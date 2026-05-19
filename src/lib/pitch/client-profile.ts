import type { GooglePlacesData } from "./researcher";

export interface ProposalClientInsight {
  metric: string;
  label: string;
  note: string;
}

export interface ProposalClientProfile {
  source: "google-places";
  placeId?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  businessStatus?: string;
  types?: string[];
  googleMapsUrl?: string;
  insights: ProposalClientInsight[];
}

function cleanText(value: unknown, max = 180): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function compactNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(Math.round(value));
}

export function proposalClientProfileFromGoogle(
  value: Partial<GooglePlacesData> | Record<string, unknown> | null | undefined,
): ProposalClientProfile | undefined {
  if (!value || typeof value !== "object") return undefined;

  const rating = cleanNumber((value as Partial<GooglePlacesData>).rating);
  const reviewCount = cleanNumber(
    (value as Partial<GooglePlacesData>).reviewCount ?? (value as Record<string, unknown>).user_ratings_total,
  );
  const address = cleanText((value as Partial<GooglePlacesData>).address, 240);
  const phone = cleanText((value as Partial<GooglePlacesData>).phone, 80);
  const businessStatus = cleanText((value as Partial<GooglePlacesData>).businessStatus, 80);
  const googleMapsUrl = cleanText((value as Partial<GooglePlacesData>).googleMapsUrl, 400);
  const placeId = cleanText((value as Partial<GooglePlacesData>).placeId, 160);
  const types = Array.isArray((value as Partial<GooglePlacesData>).types)
    ? ((value as Partial<GooglePlacesData>).types || []).map((item) => cleanText(item, 60)).filter(Boolean).slice(0, 5)
    : [];

  const hasUsefulSignal =
    rating !== undefined ||
    reviewCount !== undefined ||
    !!address ||
    !!phone ||
    !!businessStatus ||
    types.length > 0 ||
    !!googleMapsUrl ||
    !!placeId;
  if (!hasUsefulSignal) return undefined;

  const insights: ProposalClientInsight[] = [];
  if (rating !== undefined) {
    insights.push({
      metric: rating.toFixed(1),
      label: "Google rating",
      note:
        reviewCount !== undefined
          ? `${compactNumber(reviewCount)} public reviews shape local trust before a visitor reaches the website.`
          : "Public rating is a visible trust signal in local search.",
    });
  }
  if (reviewCount !== undefined) {
    insights.push({
      metric: compactNumber(reviewCount),
      label: "Google reviews",
      note: "Review volume can be used as proof while the proposal improves visibility and conversion paths.",
    });
  }
  if (types.length > 0) {
    insights.push({
      metric: "Local",
      label: types[0].replace(/_/g, " "),
      note: "The offer should be framed around how nearby customers compare and choose this category.",
    });
  }
  if (businessStatus) {
    insights.push({
      metric: businessStatus === "OPERATIONAL" ? "Open" : "Listed",
      label: "Profile status",
      note: "The Google profile is a practical channel to optimize, measure, and keep current.",
    });
  }

  return {
    source: "google-places",
    placeId: placeId || undefined,
    rating,
    reviewCount,
    address: address || undefined,
    phone: phone || undefined,
    businessStatus: businessStatus || undefined,
    types,
    googleMapsUrl: googleMapsUrl || undefined,
    insights: insights.slice(0, 4),
  };
}
