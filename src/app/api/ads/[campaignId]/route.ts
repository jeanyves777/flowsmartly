import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/ads/[campaignId] - Get a single ad campaign
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { campaignId } = await params;

    const campaign = await prisma.adCampaign.findFirst({
      where: {
        id: campaignId,
        userId: session.userId,
      },
      include: {
        posts: {
          select: {
            id: true,
            caption: true,
            mediaUrl: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: { message: "Campaign not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        campaign: {
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
          targeting: JSON.parse(campaign.targeting || "{}"),
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate?.toISOString(),
          posts: campaign.posts,
          createdAt: campaign.createdAt.toISOString(),
          updatedAt: campaign.updatedAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Get ad campaign error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch campaign" } },
      { status: 500 }
    );
  }
}

// PATCH /api/ads/[campaignId] - Update an ad campaign
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { campaignId } = await params;

    // Verify ownership
    const existingCampaign = await prisma.adCampaign.findFirst({
      where: {
        id: campaignId,
        userId: session.userId,
      },
    });

    if (!existingCampaign) {
      return NextResponse.json(
        { success: false, error: { message: "Campaign not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      objective,
      status,
      budget,
      dailyBudget,
      costPerView,
      targeting,
      startDate,
      endDate,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (objective !== undefined) updateData.objective = objective;
    if (status !== undefined) updateData.status = status.toUpperCase();
    if (budget !== undefined) updateData.budgetCents = Math.round(budget * 100);
    if (dailyBudget !== undefined) updateData.dailyBudgetCents = dailyBudget ? Math.round(dailyBudget * 100) : null;
    if (costPerView !== undefined) updateData.cpvCents = Math.round(costPerView * 100);
    if (targeting !== undefined) updateData.targeting = JSON.stringify(targeting);
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    const campaign = await prisma.adCampaign.update({
      where: { id: campaignId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status.toLowerCase(),
          updatedAt: campaign.updatedAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Update ad campaign error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update campaign" } },
      { status: 500 }
    );
  }
}

// DELETE /api/ads/[campaignId] - Delete an ad campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { campaignId } = await params;

    // Verify ownership
    const existingCampaign = await prisma.adCampaign.findFirst({
      where: {
        id: campaignId,
        userId: session.userId,
      },
    });

    if (!existingCampaign) {
      return NextResponse.json(
        { success: false, error: { message: "Campaign not found" } },
        { status: 404 }
      );
    }

    // Only allow deletion of DRAFT or SCHEDULED campaigns
    // Active, paused, and completed campaigns must remain for tracking
    const deletableStatuses = ["DRAFT", "SCHEDULED"];
    if (!deletableStatuses.includes(existingCampaign.status)) {
      return NextResponse.json(
        { success: false, error: { message: "Only draft or scheduled campaigns can be deleted. Active and completed campaigns are kept for tracking." } },
        { status: 400 }
      );
    }

    // Unlink any posts from this campaign
    await prisma.post.updateMany({
      where: { campaignId },
      data: { campaignId: null, isPromoted: false },
    });

    // Delete the campaign
    await prisma.adCampaign.delete({
      where: { id: campaignId },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error("Delete ad campaign error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete campaign" } },
      { status: 500 }
    );
  }
}
