import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getActiveAdCampaigns } from "@/lib/ads/placement-engine";
import { calculateAdRevenueSplit } from "@/lib/credits/costs";

// GET /api/earn/opportunities — Fetch available earning opportunities for the widget
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Agents impersonating clients should not see this widget
    if (session.agentId) {
      return NextResponse.json({ success: true, data: null });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Fetch all data in parallel
    const [user, campaigns, earnedToday, promotedPosts, earnedPostIds] = await Promise.all([
      // User balance
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { balanceCents: true },
      }),

      // Active non-post ad campaigns
      getActiveAdCampaigns({ excludeUserId: session.userId, limit: 5 }),

      // Total earned today
      prisma.postView.aggregate({
        where: {
          viewerUserId: session.userId,
          earnedCents: { gt: 0 },
          createdAt: { gte: todayStart },
        },
        _sum: { earnedCents: true },
      }),

      // Promoted posts the user hasn't earned from yet
      prisma.post.findMany({
        where: {
          isPromoted: true,
          status: "PUBLISHED",
          userId: { not: session.userId },
          adCampaign: {
            status: "ACTIVE",
            approvalStatus: "APPROVED",
          },
        },
        select: { id: true, adCampaign: { select: { cpvCents: true } } },
      }),

      // Posts the user already earned from
      prisma.postView.findMany({
        where: {
          viewerUserId: session.userId,
          earnedCents: { gt: 0 },
        },
        select: { postId: true },
      }),
    ]);

    // Filter out promoted posts user already earned from
    const earnedSet = new Set(earnedPostIds.map(v => v.postId));
    const unearnedPromotedPosts = promotedPosts.filter(p => !earnedSet.has(p.id));

    // Format campaign opportunities with estimated earnings
    const opportunities = campaigns.map(c => {
      const { viewerCents } = calculateAdRevenueSplit(c.cpvCents || 1);
      return {
        id: c.id,
        name: c.name,
        headline: c.headline,
        mediaUrl: c.mediaUrl,
        adType: c.adType,
        estimatedEarnCents: viewerCents,
      };
    });

    // Also add estimated earnings from promoted posts
    const promotedEarnEstimate = unearnedPromotedPosts.reduce((sum, p) => {
      const cpv = p.adCampaign?.cpvCents || 1;
      return sum + calculateAdRevenueSplit(cpv).viewerCents;
    }, 0);

    const totalOpportunities = opportunities.length + unearnedPromotedPosts.length;

    return NextResponse.json({
      success: true,
      data: {
        balanceCents: user?.balanceCents || 0,
        earnedTodayCents: earnedToday._sum.earnedCents || 0,
        opportunities,
        promotedPostCount: unearnedPromotedPosts.length,
        promotedEarnEstimateCents: promotedEarnEstimate,
        totalOpportunities,
      },
    });
  } catch (error) {
    console.error("Earn opportunities error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch opportunities" } },
      { status: 500 }
    );
  }
}
