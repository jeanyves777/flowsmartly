import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// PATCH /api/opportunities/[id] — update a deal (stage, value, status, close date…).
// Moving into a Won/Lost stage auto-sets status + closedAt and logs the change.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const { id } = await params;

    const existing = await prisma.opportunity.findFirst({ where: { id, userId: session.userId } });
    if (!existing) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") data.title = body.title.slice(0, 200);
    if (Number.isFinite(Number(body.value))) data.value = Number(body.value);
    if (typeof body.probability === "number") data.probability = Math.min(100, Math.max(0, body.probability));
    if (typeof body.expectedCloseAt !== "undefined") data.expectedCloseAt = body.expectedCloseAt ? new Date(body.expectedCloseAt) : null;
    if (typeof body.pitchId === "string") data.pitchId = body.pitchId;

    let movedTo: string | null = null;
    if (typeof body.stageId === "string") {
      const stage = await prisma.pipelineStage.findFirst({ where: { id: body.stageId, userId: session.userId } });
      if (stage) {
        data.stageId = stage.id;
        movedTo = stage.name;
        // Won/Lost stages resolve the deal; anything else re-opens it.
        if (stage.isWon) { data.status = "won"; data.closedAt = new Date(); }
        else if (stage.isLost) { data.status = "lost"; data.closedAt = new Date(); }
        else { data.status = "open"; data.closedAt = null; }
      }
    }
    if (typeof body.status === "string" && !data.status) data.status = body.status;

    const opportunity = await prisma.opportunity.update({ where: { id }, data });
    if (movedTo) {
      await prisma.activity.create({
        data: { userId: session.userId, type: "stage_change", subject: `Moved to ${movedTo}`, opportunityId: id, savedLeadId: opportunity.savedLeadId },
      }).catch(() => {});
    }
    return NextResponse.json({ success: true, data: { opportunity } });
  } catch (error) {
    console.error("Update opportunity error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update opportunity" } }, { status: 500 });
  }
}

// DELETE /api/opportunities/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const { id } = await params;
    const existing = await prisma.opportunity.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
    await prisma.opportunity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete opportunity error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete opportunity" } }, { status: 500 });
  }
}
