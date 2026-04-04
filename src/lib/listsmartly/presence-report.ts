/**
 * Presence report generator for ListSmartly.
 * 4-phase pipeline: aggregate stats -> score -> AI summary -> store report.
 */

import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { calculateCitationScore } from "./citation-scorer";

interface ReportResult {
  reportId: string;
  citationScore: number;
  overallScore: number;
  summary: string;
  recommendations: string[];
}

/**
 * Generate a full presence report for a ListSmartly profile.
 *
 * Phase 1: Aggregate listing + review stats from DB
 * Phase 2: Calculate scores using citation-scorer
 * Phase 3: AI generates executive summary + recommendations
 * Phase 4: Store PresenceReport record, update profile denormalized scores
 */
export async function generatePresenceReport(
  profileId: string,
  triggeredBy: string = "user"
): Promise<ReportResult> {
  // ── Phase 1: Aggregate stats ──

  const profile = await prisma.listSmartlyProfile.findUnique({
    where: { id: profileId },
  });
  if (!profile) throw new Error("Profile not found");

  const listings = await prisma.businessListing.findMany({
    where: { profileId },
    include: { directory: { select: { name: true, tier: true } } },
  });

  const reviews = await prisma.listingReview.findMany({
    where: { profileId },
    select: { rating: true, sentiment: true, responseStatus: true, publishedAt: true },
  });

  const now = new Date();
  const periodEnd = now;
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // New reviews in the reporting period
  const newReviews = reviews.filter(
    (r) => r.publishedAt && r.publishedAt >= periodStart && r.publishedAt <= periodEnd
  );

  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
      : 0;

  const respondedReviews = reviews.filter(
    (r) => r.responseStatus === "posted" || r.responseStatus === "ai_drafted"
  );
  const responseRate = totalReviews > 0 ? respondedReviews.length / totalReviews : 0;

  // ── Phase 2: Calculate scores ──

  const scorerInput = listings.map((l) => ({
    status: l.status,
    isConsistent: l.isConsistent,
    tier: l.directory.tier,
  }));

  const scores = calculateCitationScore({
    listings: scorerInput,
    totalReviews,
    averageRating,
    responseRate,
  });

  const overallScore = scores.citationScore;

  // Missing and inconsistent counts
  const liveListings = listings.filter(
    (l) => l.status === "live" || l.status === "submitted" || l.status === "claimed"
  );
  const inconsistentListings = liveListings.filter((l) => !l.isConsistent);
  const missingListings = listings.filter((l) => l.status === "missing");

  // ── Phase 3: AI executive summary + recommendations ──

  const liveDirectoryNames = liveListings.map((l) => l.directory.name).join(", ");
  const missingDirectoryNames = missingListings
    .map((l) => l.directory.name)
    .slice(0, 10)
    .join(", ");

  const prompt = `Generate an executive summary and actionable recommendations for this business presence report:

Business: ${profile.businessName}
Industry: ${profile.industry || "General"}

Citation Score: ${overallScore}/100
- Coverage Score: ${scores.coverageScore}/100
- Consistency Score: ${scores.consistencyScore}/100
- Review Score: ${scores.reviewScore}/100

Listing Stats:
- Total Listings: ${listings.length}
- Live Listings: ${liveListings.length} (${liveDirectoryNames || "none"})
- Missing Listings: ${missingListings.length} (${missingDirectoryNames || "none"})
- Inconsistent Listings: ${inconsistentListings.length}

Review Stats:
- Total Reviews: ${totalReviews}
- New Reviews (this month): ${newReviews.length}
- Average Rating: ${averageRating}/5
- Response Rate: ${Math.round(responseRate * 100)}%

Sentiment Breakdown:
- Positive: ${reviews.filter((r) => r.sentiment === "positive").length}
- Neutral: ${reviews.filter((r) => r.sentiment === "neutral").length}
- Negative: ${reviews.filter((r) => r.sentiment === "negative").length}
- Unanalyzed: ${reviews.filter((r) => !r.sentiment).length}

Return JSON: {
  "summary": "2-3 paragraph executive summary covering strengths and areas for improvement",
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2", "..."],
  "competitorInsights": "Brief competitive positioning analysis based on citation scores"
}`;

  const aiResult = await ai.generateJSON<{
    summary: string;
    recommendations: string[];
    competitorInsights: string;
  }>(prompt, {
    systemPrompt: SYSTEM_PROMPTS.presenceAnalyst,
    maxTokens: 1024,
  });

  const summary = aiResult?.summary || "Report generated. Review your scores above for insights.";
  const recommendations = aiResult?.recommendations || [];
  const competitorInsights = aiResult?.competitorInsights || null;

  // ── Phase 4: Store report + update profile ──

  // Fetch score history from previous reports
  const previousReports = await prisma.presenceReport.findMany({
    where: { profileId },
    orderBy: { periodEnd: "desc" },
    take: 12,
    select: { periodEnd: true, citationScore: true, overallScore: true },
  });

  const scoreHistory = [
    ...previousReports.map((r) => ({
      date: r.periodEnd.toISOString(),
      citation: r.citationScore,
      overall: r.overallScore,
    })),
    {
      date: periodEnd.toISOString(),
      citation: scores.citationScore,
      overall: overallScore,
    },
  ];

  const report = await prisma.presenceReport.create({
    data: {
      profileId,
      periodStart,
      periodEnd,
      citationScore: scores.citationScore,
      consistencyScore: scores.consistencyScore,
      coverageScore: scores.coverageScore,
      reviewScore: scores.reviewScore,
      overallScore,
      totalListings: listings.length,
      liveListings: liveListings.length,
      inconsistentListings: inconsistentListings.length,
      missingListings: missingListings.length,
      totalReviews,
      newReviews: newReviews.length,
      averageRating,
      responseRate: Math.round(responseRate * 100) / 100,
      summary,
      recommendations: JSON.stringify(recommendations),
      competitorInsights,
      scoreHistory: JSON.stringify(scoreHistory),
      triggeredBy,
    },
  });

  // Update profile denormalized scores
  await prisma.listSmartlyProfile.update({
    where: { id: profileId },
    data: {
      citationScore: scores.citationScore,
      totalReviews,
      averageRating,
    },
  });

  return {
    reportId: report.id,
    citationScore: scores.citationScore,
    overallScore,
    summary,
    recommendations,
  };
}
