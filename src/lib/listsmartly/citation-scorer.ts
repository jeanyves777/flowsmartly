/**
 * Citation score calculator for ListSmartly.
 * Heuristic-only — no AI credits needed.
 *
 * citationScore = coverageScore×0.40 + consistencyScore×0.35 + reviewScore×0.25
 */

import { TIER_CONFIG } from "@/lib/constants/listsmartly";

interface ScorerInput {
  listings: Array<{ status: string; isConsistent: boolean; tier: number }>;
  totalReviews: number;
  averageRating: number;
  responseRate: number; // 0-1
  industryReviewBenchmark?: number; // typical review count for industry
}

interface ScoreResult {
  citationScore: number;       // 0-100 overall
  coverageScore: number;       // 0-100
  consistencyScore: number;    // 0-100
  reviewScore: number;         // 0-100
  breakdown: {
    liveListings: number;
    totalListings: number;
    consistentListings: number;
    liveByTier: Record<number, { live: number; total: number }>;
  };
}

export function calculateCitationScore(input: ScorerInput): ScoreResult {
  const { listings, totalReviews, averageRating, responseRate, industryReviewBenchmark = 50 } = input;

  // Coverage: weighted by tier
  let earnedPoints = 0;
  let maxPoints = 0;
  const liveByTier: Record<number, { live: number; total: number }> = {};

  for (const listing of listings) {
    const weight = TIER_CONFIG[listing.tier as keyof typeof TIER_CONFIG]?.weight || 1;
    maxPoints += weight;

    if (!liveByTier[listing.tier]) liveByTier[listing.tier] = { live: 0, total: 0 };
    liveByTier[listing.tier].total++;

    if (listing.status === "live" || listing.status === "submitted" || listing.status === "claimed") {
      earnedPoints += weight;
      liveByTier[listing.tier].live++;
    }
  }
  const coverageScore = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;

  // Consistency: % of live listings that are consistent
  const liveListings = listings.filter(
    (l) => l.status === "live" || l.status === "submitted" || l.status === "claimed"
  );
  const consistentListings = liveListings.filter((l) => l.isConsistent);
  const consistencyScore =
    liveListings.length > 0
      ? Math.round((consistentListings.length / liveListings.length) * 100)
      : 0;

  // Review score: rating (40%) + volume (30%) + response rate (30%)
  const ratingComponent = Math.min(100, (averageRating / 5) * 100) * 0.4;
  const volumeComponent = Math.min(100, (totalReviews / industryReviewBenchmark) * 100) * 0.3;
  const responseComponent = Math.min(100, responseRate * 100) * 0.3;
  const reviewScore = Math.round(ratingComponent + volumeComponent + responseComponent);

  // Overall weighted score
  const citationScore = Math.round(
    coverageScore * 0.4 + consistencyScore * 0.35 + reviewScore * 0.25
  );

  return {
    citationScore,
    coverageScore,
    consistencyScore,
    reviewScore,
    breakdown: {
      liveListings: liveListings.length,
      totalListings: listings.length,
      consistentListings: consistentListings.length,
      liveByTier,
    },
  };
}
