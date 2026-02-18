import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { creditService, TRANSACTION_TYPES, CREDIT_TO_CENTS } from "@/lib/credits";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { generateAdPageHtml, generateAdPageSlug } from "@/lib/ads/ad-page-generator";

const VALID_AD_TYPES = ["POST", "PRODUCT_LINK", "LANDING_PAGE", "EXTERNAL_URL"] as const;

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
    const adType = searchParams.get("adType");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {
      userId: session.userId,
    };

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    if (adType && adType !== "all") {
      where.adType = adType.toUpperCase();
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
          adPage: {
            select: {
              id: true,
              slug: true,
              views: true,
              clicks: true,
            },
          },
          landingPage: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnailUrl: true,
            },
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

    const pendingCount = await prisma.adCampaign.count({
      where: { userId: session.userId, approvalStatus: "PENDING" },
    });

    const formattedCampaigns = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status.toLowerCase(),
      adType: campaign.adType,
      approvalStatus: campaign.approvalStatus,
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
      // Ad content
      headline: campaign.headline,
      description: campaign.description,
      destinationUrl: campaign.destinationUrl,
      mediaUrl: campaign.mediaUrl,
      videoUrl: campaign.videoUrl,
      ctaText: campaign.ctaText,
      adCategory: campaign.adCategory,
      rejectionReason: campaign.rejectionReason,
      // Relations
      post: campaign.posts[0] || null,
      adPage: campaign.adPage || null,
      landingPage: campaign.landingPage || null,
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
          pending: pendingCount,
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

    const gate = await checkPlanAccess(session.user.plan, "Ad campaigns", session.userId);
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
      // New ad type fields
      adType: rawAdType,
      headline,
      description,
      destinationUrl,
      mediaUrl,
      videoUrl,
      ctaText,
      templateStyle,
      adCategory,
      landingPageId,
    } = body;

    const adType = (rawAdType || "POST").toUpperCase();

    if (!VALID_AD_TYPES.includes(adType as (typeof VALID_AD_TYPES)[number])) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid ad type. Must be POST, PRODUCT_LINK, LANDING_PAGE, or EXTERNAL_URL." } },
        { status: 400 }
      );
    }

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

    // Ad-type-specific validation
    if (adType === "PRODUCT_LINK" || adType === "EXTERNAL_URL") {
      if (!destinationUrl?.trim()) {
        return NextResponse.json(
          { success: false, error: { message: "Destination URL is required for this ad type." } },
          { status: 400 }
        );
      }
      if (!headline?.trim()) {
        return NextResponse.json(
          { success: false, error: { message: "Headline is required for this ad type." } },
          { status: 400 }
        );
      }
    }

    if (adType === "LANDING_PAGE") {
      if (!landingPageId) {
        return NextResponse.json(
          { success: false, error: { message: "Please select a landing page to promote." } },
          { status: 400 }
        );
      }
      // Verify landing page belongs to user and is published
      const lp = await prisma.landingPage.findFirst({
        where: { id: landingPageId, userId: session.userId, status: "PUBLISHED" },
        select: { id: true, title: true, slug: true },
      });
      if (!lp) {
        return NextResponse.json(
          { success: false, error: { message: "Landing page not found or not published." } },
          { status: 404 }
        );
      }
    }

    // Post validation (POST type)
    const resolvedPostIds: string[] = postIds?.length
      ? postIds
      : postId
        ? [postId]
        : [];

    if (adType === "POST" && resolvedPostIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "Select at least one post to promote." } },
        { status: 400 }
      );
    }

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

    // Content policy validation
    if (adType !== "POST" && !adCategory?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Ad category is required." } },
        { status: 400 }
      );
    }

    // Budget check & deduct credits
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

    const isBoost = adType === "POST" && !!postId && !postIds?.length;

    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditBudget,
      description: isBoost
        ? `Ad boost: ${name} (${creditBudget} credits)`
        : `Ad campaign: ${name} (${creditBudget} credits)`,
      referenceType: "ad_campaign",
    });

    // Convert credits to cents for campaign budget
    const budgetCents = creditBudget * CREDIT_TO_CENTS;
    const dailyBudgetCents: number | null = dailyBudget ? Math.round(dailyBudget * 100) : null;

    // Auto-generate AdPage for link-type ads
    let adPageId: string | undefined;

    if (adType === "PRODUCT_LINK" || adType === "EXTERNAL_URL") {
      const slug = generateAdPageSlug();
      const htmlContent = generateAdPageHtml({
        headline: headline || name,
        description,
        mediaUrl,
        videoUrl,
        destinationUrl,
        ctaText: ctaText || "Learn More",
        slug,
        templateStyle: templateStyle || "hero",
      });

      const adPage = await prisma.adPage.create({
        data: {
          slug,
          headline: headline || name,
          description,
          mediaUrl,
          videoUrl,
          destinationUrl,
          ctaText: ctaText || "Learn More",
          templateStyle: templateStyle || "hero",
          // Store generated HTML in a way the serving route can use
          // We regenerate on the fly from stored fields, so htmlContent is not stored
        },
      });
      adPageId = adPage.id;
    }

    // Determine initial status: POST type ads that only boost go ACTIVE, all others go PENDING_REVIEW
    const initialStatus = adType === "POST" ? "ACTIVE" : "PENDING_REVIEW";
    const initialApprovalStatus = adType === "POST" ? "APPROVED" : "PENDING";

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
        status: initialStatus,
        // New fields
        adType,
        headline: headline || null,
        description: description || null,
        destinationUrl: destinationUrl || null,
        mediaUrl: mediaUrl || null,
        videoUrl: videoUrl || null,
        ctaText: ctaText || "Learn More",
        adCategory: adCategory || null,
        contentRating: "GENERAL",
        approvalStatus: initialApprovalStatus,
        adPageId: adPageId || null,
        landingPageId: adType === "LANDING_PAGE" ? landingPageId : null,
      },
    });

    // Link posts to campaign (POST type)
    if (adType === "POST" && resolvedPostIds.length > 0) {
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
          adType: campaign.adType,
          status: campaign.status.toLowerCase(),
          approvalStatus: campaign.approvalStatus,
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
