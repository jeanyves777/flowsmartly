import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import { notifyComplianceApproved, notifyComplianceRejected } from "@/lib/notifications";
import { assignNumberToCampaign, getA2pCampaignStatus } from "@/lib/telnyx/numbers";

// POST /api/admin/sms/compliance/[userId]/review - Approve or reject a compliance submission
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { userId } = await params;
    const body = await request.json();
    const { action, notes } = body as {
      action: "approve" | "reject";
      notes?: string;
    };

    // Validate action
    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Invalid action. Must be 'approve' or 'reject'." },
        },
        { status: 400 }
      );
    }

    // Find the MarketingConfig for this user
    const config = await prisma.marketingConfig.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Marketing config not found for this user" },
        },
        { status: 404 }
      );
    }

    // Determine new status
    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

    // Update the compliance status
    const updated = await prisma.marketingConfig.update({
      where: { userId },
      data: {
        smsComplianceStatus: newStatus,
        complianceReviewedAt: new Date(),
        complianceReviewedBy: session.adminId,
        complianceNotes: notes || null,
        // If approved, enable SMS for the user
        ...(action === "approve" ? { smsEnabled: true } : {}),
      },
    });

    // On approval, route the business under our default system campaign so
    // "approved" → "ready to send" is one step. Idempotent; the attach is
    // deferred (non-fatal) until the campaign clears carrier review.
    if (action === "approve") {
      const defaultCampaignId = process.env.TELNYX_DEFAULT_CAMPAIGN_ID;
      if (defaultCampaignId && updated.smsPhoneNumber) {
        const assign = await assignNumberToCampaign(updated.smsPhoneNumber, defaultCampaignId).catch(() => ({ ok: false as const, error: "assign failed" }));
        const status = await getA2pCampaignStatus("", defaultCampaignId).catch(() => ({ success: false, status: undefined as string | undefined }));
        await prisma.marketingConfig.update({
          where: { userId },
          data: {
            smsA2pCampaignSid: defaultCampaignId,
            smsA2pCampaignStatus: assign.ok ? (status.status || "VERIFIED") : "PENDING",
            smsA2pBrandSid: updated.smsA2pBrandSid || process.env.TELNYX_10DLC_BRAND_ID || null,
            smsA2pBrandStatus: "APPROVED",
          },
        }).catch(() => {});
      }
    }

    // Send notification email to user (fire-and-forget)
    if (action === "approve") {
      notifyComplianceApproved({
        userId,
        email: config.user.email,
        name: config.user.name || config.user.email,
        businessName: config.businessName || "Your business",
      }).catch(() => {});
    } else {
      notifyComplianceRejected({
        userId,
        email: config.user.email,
        name: config.user.name || config.user.email,
        businessName: config.businessName || "Your business",
        notes: notes || "No specific notes provided.",
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: {
        userId,
        smsComplianceStatus: updated.smsComplianceStatus,
        complianceReviewedAt: updated.complianceReviewedAt?.toISOString(),
        complianceReviewedBy: updated.complianceReviewedBy,
        complianceNotes: updated.complianceNotes,
        action,
      },
    });
  } catch (error) {
    console.error("Compliance review error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Failed to process compliance review" },
      },
      { status: 500 }
    );
  }
}
