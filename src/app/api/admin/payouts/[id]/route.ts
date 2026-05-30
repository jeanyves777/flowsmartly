import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

/**
 * PATCH /api/admin/payouts/[id]
 *
 * Admin-only approval workflow for creator payouts. The user-facing
 * /api/earnings POST creates a Payout in PENDING and decrements the
 * user's balance up front. This endpoint moves PENDING -> COMPLETED or
 * PENDING -> FAILED. On FAILED we refund the amount back to
 * User.balanceCents so the creator can request again (or the admin can
 * try another method).
 *
 * Body: { status: "COMPLETED" | "FAILED", failedReason?: string }
 */

const VALID_TRANSITIONS = new Set(["COMPLETED", "FAILED"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const status = typeof body.status === "string" ? body.status.toUpperCase() : "";
    const failedReason =
      typeof body.failedReason === "string" ? body.failedReason.trim().slice(0, 500) : null;

    if (!VALID_TRANSITIONS.has(status)) {
      return NextResponse.json(
        { success: false, error: { message: "status must be COMPLETED or FAILED" } },
        { status: 400 },
      );
    }
    if (status === "FAILED" && !failedReason) {
      return NextResponse.json(
        { success: false, error: { message: "failedReason is required when marking FAILED" } },
        { status: 400 },
      );
    }

    const existing = await prisma.payout.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        amountCents: true,
        status: true,
        method: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Payout not found" } },
        { status: 404 },
      );
    }
    if (existing.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Payout is already ${existing.status.toLowerCase()} -- can't transition again.`,
          },
        },
        { status: 400 },
      );
    }

    // On FAILED, refund the user's balance in the same transaction so the
    // ledger stays consistent. COMPLETED leaves balance alone (it was
    // already deducted when the request was created).
    const updates: { status: string; processedAt: Date; failedReason?: string | null } = {
      status,
      processedAt: new Date(),
    };
    if (status === "FAILED") {
      updates.failedReason = failedReason;
    }

    const [updated] = await prisma.$transaction([
      prisma.payout.update({ where: { id }, data: updates }),
      ...(status === "FAILED"
        ? [
            prisma.user.update({
              where: { id: existing.userId },
              data: { balanceCents: { increment: existing.amountCents } },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        payout: {
          id: updated.id,
          status: updated.status.toLowerCase(),
          processedAt: updated.processedAt?.toISOString() ?? null,
          failedReason: updated.failedReason ?? null,
        },
        refunded: status === "FAILED",
      },
    });
  } catch (error) {
    console.error("Admin payout PATCH error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update payout" } },
      { status: 500 },
    );
  }
}
