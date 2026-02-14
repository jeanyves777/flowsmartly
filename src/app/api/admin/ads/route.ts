import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/admin/ads - List ad campaigns for admin review
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {};

    if (status !== "all") {
      where.approvalStatus = status.toUpperCase();
    }

    const [campaigns, total] = await Promise.all([
      prisma.adCampaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
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

    // Get review stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingCount, approvedToday, rejectedToday] = await Promise.all([
      prisma.adCampaign.count({ where: { approvalStatus: "PENDING" } }),
      prisma.adCampaign.count({
        where: { approvalStatus: "APPROVED", reviewedAt: { gte: today } },
      }),
      prisma.adCampaign.count({
        where: { approvalStatus: "REJECTED", reviewedAt: { gte: today } },
      }),
    ]);

    const formattedCampaigns = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      adType: campaign.adType,
      status: campaign.status,
      approvalStatus: campaign.approvalStatus,
      // Content
      headline: campaign.headline,
      description: campaign.description,
      destinationUrl: campaign.destinationUrl,
      mediaUrl: campaign.mediaUrl,
      videoUrl: campaign.videoUrl,
      ctaText: campaign.ctaText,
      adCategory: campaign.adCategory,
      contentRating: campaign.contentRating,
      rejectionReason: campaign.rejectionReason,
      // Budget
      budget: campaign.budgetCents / 100,
      spent: campaign.spentCents / 100,
      impressions: campaign.impressions,
      clicks: campaign.clicks,
      // Dates
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate?.toISOString(),
      reviewedAt: campaign.reviewedAt?.toISOString(),
      createdAt: campaign.createdAt.toISOString(),
      // Relations
      user: campaign.user,
      post: campaign.posts[0] || null,
      adPage: campaign.adPage || null,
      landingPage: campaign.landingPage || null,
    }));

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        campaigns: formattedCampaigns,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        stats: {
          pending: pendingCount,
          approvedToday,
          rejectedToday,
        },
      }),
    });
  } catch (error) {
    console.error("Admin ads list error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch ads for review" } },
      { status: 500 }
    );
  }
}
