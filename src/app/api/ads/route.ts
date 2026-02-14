import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { creditService, TRANSACTION_TYPES, CREDIT_TO_CENTS } from "@/lib/credits";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/ads - Get user's ad campaigns
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {
      userId: session.userId,
    };

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    const [campaigns, total] = await Promise.all([
      prisma.adCampaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          posts: {
            select: {
              id: true,
              caption: true,
              mediaUrl: true,
            },
            take: 1,
          },
        },
      }),
      prisma.adCampaign.count({ where }),
    ]);

    // Get stats
    const [totalCampaigns, activeCampaigns, totalSpent, totalImpressions] = await Promise.all([
      prisma.adCampaign.count({ where: { userId: session.userId } }),
      prisma.adCampaign.count({ where: { userId: session.userId, status: "ACTIVE" } }),
      prisma.adCampaign.aggregate({
        where: { userId: session.userId },
        _sum: { spentCents: true },
      }),
      prisma.adCampaign.aggregate({
        where: { userId: session.userId },
        _sum: { impressions: true },
      }),
    ]);

    const formattedCampaigns = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status.toLowerCase(),
      budget: campaign.budgetCents / 100,
      spent: campaign.spentCents / 100,
      dailyBudget: campaign.dailyBudgetCents ? campaign.dailyBudgetCents / 100 : null,
      costPerView: campaign.cpvCents / 100,
      impressions: campaign.impressions,
      clicks: campaign.clicks,
      conversions: campaign.conversions,
      ctr: campaign.impressions > 0 ? Math.round((campaign.clicks / campaign.impressions) * 100 * 100) / 100 : 0,
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate?.toISOString(),
      post: campaign.posts[0] || null,
      createdAt: campaign.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        campaigns: formattedCampaigns,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        stats: {
          total: totalCampaigns,
          active: activeCampaigns,
          totalSpent: (totalSpent._sum.spentCents || 0) / 100,
          totalImpressions: totalImpressions._sum.impressions || 0,
        },
      }),
    });
  } catch (error) {
    console.error("Get ad campaigns error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch ad campaigns" } },
      { status: 500 }
    );
  }
}

// POST /api/ads - Create a new ad campaign
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const gate = checkPlanAccess(session.user.plan, "Ad campaigns");
    if (gate) return gate;

    const body = await request.json();
    const {
      name,
      objective,
      budget,
      dailyBudget,
      costPerView,
      targeting,
      startDate,
      endDate,
      postId,
      postIds,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Campaign name is required" } },
        { status: 400 }
      );
    }

    if (!budget || budget <= 0) {
      return NextResponse.json(
        { success: false, error: { message: "Valid budget is required" } },
        { status: 400 }
      );
    }

    if (!startDate) {
      return NextResponse.json(
        { success: false, error: { message: "Start date is required" } },
        { status: 400 }
      );
    }

    // Normalize single postId and postIds[] into one array
    const resolvedPostIds: string[] = postIds?.length
      ? postIds
      : postId
        ? [postId]
        : [];

    // Verify all posts belong to user
    if (resolvedPostIds.length > 0) {
      const userPosts = await prisma.post.findMany({
        where: { id: { in: resolvedPostIds }, userId: session.userId },
        select: { id: true },
      });
      if (userPosts.length !== resolvedPostIds.length) {
        return NextResponse.json(
          { success: false, error: { message: "One or more posts not found" } },
          { status: 404 }
        );
      }
    }

    // Budget is always in credits — deduct and go ACTIVE
    const creditBudget = Math.round(budget);
    if (creditBudget < 1) {
      return NextResponse.json(
        { success: false, error: { message: "Minimum budget is 1 credit" } },
        { status: 400 }
      );
    }

    const balance = await creditService.getBalance(session.userId);
    if (balance < creditBudget) {
      return NextResponse.json(
        { success: false, error: { message: `Insufficient credits. You need ${creditBudget} credits (you have ${balance}).` } },
        { status: 400 }
      );
    }

    const isBoost = !!postId && !postIds?.length;

    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditBudget,
      description: isBoost
        ? `Ad boost: ${name} (${creditBudget} credits)`
        : `Ad campaign: ${name} (${creditBudget} credits)`,
      referenceType: "ad_campaign",
    });

    // Convert credits to cents for campaign budget (1 credit = CREDIT_TO_CENTS cents)
    const budgetCents = creditBudget * CREDIT_TO_CENTS;
    const dailyBudgetCents: number | null = dailyBudget ? Math.round(dailyBudget * 100) : null;

    const campaign = await prisma.adCampaign.create({
      data: {
        userId: session.userId,
        name,
        objective: objective || "AWARENESS",
        budgetCents,
        dailyBudgetCents,
        cpvCents: Math.round((costPerView || 0.01) * 100),
        targeting: JSON.stringify(targeting || {}),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: "ACTIVE",
      },
    });

    // Link posts to campaign
    if (resolvedPostIds.length > 0) {
      await prisma.post.updateMany({
        where: { id: { in: resolvedPostIds } },
        data: { campaignId: campaign.id, isPromoted: true },
      });
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status.toLowerCase(),
          createdAt: campaign.createdAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Create ad campaign error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create ad campaign" } },
      { status: 500 }
    );
  }
}
