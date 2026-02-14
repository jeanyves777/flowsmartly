import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import { notifyComplianceApproved, notifyComplianceRejected } from "@/lib/notifications";

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
