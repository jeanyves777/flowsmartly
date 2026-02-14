import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { activateOnAllChannels } from "@/lib/ads/placement-engine";

// POST /api/admin/ads/[campaignId]/review - Approve or reject an ad campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { campaignId } = await params;
    const body = await request.json();
    const { action, reason, refundCredits } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: { message: "Action must be 'approve' or 'reject'" } },
        { status: 400 }
      );
    }

    const campaign = await prisma.adCampaign.findUnique({
      where: { id: campaignId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        posts: { select: { id: true } },
        adPage: { select: { id: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: { message: "Campaign not found" } },
        { status: 404 }
      );
    }

    if (campaign.approvalStatus !== "PENDING") {
      return NextResponse.json(
        { success: false, error: { message: `Campaign already ${campaign.approvalStatus.toLowerCase()}` } },
        { status: 400 }
      );
    }

    if (action === "approve") {
      // Approve the campaign
      await prisma.adCampaign.update({
        where: { id: campaignId },
        data: {
          approvalStatus: "APPROVED",
          status: "ACTIVE",
          reviewedAt: new Date(),
          reviewedBy: admin.adminId,
        },
      });

      // For POST type: mark linked posts as promoted
      if (campaign.adType === "POST" && campaign.posts.length > 0) {
        await prisma.post.updateMany({
          where: { id: { in: campaign.posts.map(p => p.id) } },
          data: { isPromoted: true },
        });
      }

      // For AdPage types: ensure ad page is ACTIVE
      if (campaign.adPage) {
        await prisma.adPage.update({
          where: { id: campaign.adPage.id },
          data: { status: "ACTIVE" },
        });
      }

      // Activate on all placement channels (feed + Google Ads if configured)
      const placements = await activateOnAllChannels(campaignId);

      // Create notification for user
      await prisma.notification.create({
        data: {
          userId: campaign.userId,
          type: "AD_APPROVED",
          title: "Ad Campaign Approved",
          message: `Your ad campaign "${campaign.name}" has been approved and is now active.`,
          actionUrl: `/ads`,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          message: "Campaign approved and activated",
          placements,
        },
      });
    } else {
      // Reject the campaign
      if (!reason?.trim()) {
        return NextResponse.json(
          { success: false, error: { message: "Rejection reason is required" } },
          { status: 400 }
        );
      }

      await prisma.adCampaign.update({
        where: { id: campaignId },
        data: {
          approvalStatus: "REJECTED",
          status: "REJECTED",
          rejectionReason: reason,
          reviewedAt: new Date(),
          reviewedBy: admin.adminId,
        },
      });

      // Pause ad page if exists
      if (campaign.adPage) {
        await prisma.adPage.update({
          where: { id: campaign.adPage.id },
          data: { status: "PAUSED" },
        });
      }

      // Optionally refund credits
      if (refundCredits) {
        const refundAmount = Math.round(campaign.budgetCents / 1); // 1 credit = 1 cent
        await creditService.addCredits({
          userId: campaign.userId,
          type: TRANSACTION_TYPES.REFUND,
          amount: refundAmount,
          description: `Ad campaign rejected: ${campaign.name} (refund)`,
          referenceType: "ad_campaign",
          referenceId: campaign.id,
        });
      }

      // Create notification for user
      await prisma.notification.create({
        data: {
          userId: campaign.userId,
          type: "AD_REJECTED",
          title: "Ad Campaign Rejected",
          message: `Your ad campaign "${campaign.name}" was rejected. Reason: ${reason}${refundCredits ? " Credits have been refunded." : ""}`,
          actionUrl: `/ads`,
        },
      });

      return NextResponse.json({
        success: true,
        data: { message: `Campaign rejected${refundCredits ? " and credits refunded" : ""}` },
      });
    }
  } catch (error) {
    console.error("Admin ad review error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to review campaign" } },
      { status: 500 }
    );
  }
}
