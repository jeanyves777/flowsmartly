import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

interface Params {
  params: Promise<{ id: string; autoId: string }>;
}

const VALID_ACTIONS = new Set(["approve", "skip", "revert"]);

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id, autoId } = await params;

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const action = typeof body.action === "string" ? body.action : "";
  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      { success: false, error: { message: "Invalid action" } },
      { status: 400 },
    );
  }

  const existing = await prisma.contentAutomation.findFirst({
    where: { id: autoId, campaignId: id, userId: session.userId },
    select: { id: true, reviewStatus: true },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: { message: "Automation not found" } },
      { status: 404 },
    );
  }

  const next =
    action === "approve"
      ? "APPROVED"
      : action === "skip"
      ? "SKIPPED"
      : "PENDING_REVIEW";

  const automation = await prisma.contentAutomation.update({
    where: { id: autoId },
    data: {
      reviewStatus: next,
      reviewedAt: action === "revert" ? null : new Date(),
    },
  });

  // Auto-arm: a DRAFT campaign flips to ACTIVE the moment any item is
  // approved. Mirrors "approving content arms the campaign" UX from
  // email tools. Once ACTIVE the user toggles Pause / Resume manually.
  if (action === "approve") {
    await prisma.contentCampaign
      .updateMany({
        where: { id, userId: session.userId, status: "DRAFT" },
        data: { status: "ACTIVE" },
      })
      .catch((err) =>
        console.warn("[review] auto-activate campaign failed:", err),
      );
  }

  return NextResponse.json({ success: true, data: { automation } });
}
