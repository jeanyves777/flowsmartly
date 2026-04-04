import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { calculateCitationScore } from "@/lib/listsmartly/citation-scorer";

// GET /api/listsmartly/analytics - Return presence analytics
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    // Fetch listings with directory tier
    const listings = await prisma.businessListing.findMany({
      where: { profileId: profile.id },
      include: { directory: { select: { tier: true } } },
    });

    // Fetch reviews
    const reviews = await prisma.listingReview.findMany({
      where: { profileId: profile.id },
      select: { rating: true, responseStatus: true, sentiment: true, platform: true, publishedAt: true },
    });

    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;
    const respondedReviews = reviews.filter((r) => r.responseStatus === "posted").length;
    const responseRate = totalReviews > 0 ? respondedReviews / totalReviews : 0;

    // Calculate scores
    const scores = calculateCitationScore({
      listings: listings.map((l) => ({
        status: l.status,
        isConsistent: l.isConsistent,
        tier: l.directory.tier,
      })),
      totalReviews,
      averageRating,
      responseRate,
    });

    // Listing status counts
    const statusCounts: Record<string, number> = {};
    for (const listing of listings) {
      statusCounts[listing.status] = (statusCounts[listing.status] || 0) + 1;
    }

    // Review sentiment counts
    const sentimentCounts: Record<string, number> = {};
    for (const review of reviews) {
      const s = review.sentiment || "unknown";
      sentimentCounts[s] = (sentimentCounts[s] || 0) + 1;
    }

    // Reviews by platform
    const reviewsByPlatform: Record<string, number> = {};
    for (const review of reviews) {
      reviewsByPlatform[review.platform] = (reviewsByPlatform[review.platform] || 0) + 1;
    }

    // Monthly review trend (last 12 months)
    const monthlyReviews: Record<string, number> = {};
    for (const review of reviews) {
      if (review.publishedAt) {
        const key = review.publishedAt.toISOString().slice(0, 7); // YYYY-MM
        monthlyReviews[key] = (monthlyReviews[key] || 0) + 1;
      }
    }

    // Tier breakdown
    const tierCounts: Record<number, { live: number; total: number }> = {};
    for (const listing of listings) {
      const tier = listing.directory.tier;
      if (!tierCounts[tier]) tierCounts[tier] = { live: 0, total: 0 };
      tierCounts[tier].total++;
      if (["live", "submitted", "claimed"].includes(listing.status)) {
        tierCounts[tier].live++;
      }
    }
    const listingsByTier = Object.entries(tierCounts).map(([tier, counts]) => ({
      tier: Number(tier),
      ...counts,
      percentage: counts.total > 0 ? Math.round((counts.live / counts.total) * 100) : 0,
    })).sort((a, b) => a.tier - b.tier);

    return NextResponse.json({
      success: true,
      data: {
        scores: {
          citationScore: scores.citationScore,
          coverageScore: scores.coverageScore,
          consistencyScore: scores.consistencyScore,
          reviewScore: scores.reviewScore,
          breakdown: scores.breakdown,
        },
        listings: {
          total: listings.length,
          statusCounts,
        },
        listingsByTier,
        reviews: {
          total: totalReviews,
          averageRating: Math.round(averageRating * 10) / 10,
          responseRate: Math.round(responseRate * 100),
          sentimentCounts,
          byPlatform: reviewsByPlatform,
          monthlyTrend: monthlyReviews,
        },
      },
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch analytics" } },
      { status: 500 }
    );
  }
}
