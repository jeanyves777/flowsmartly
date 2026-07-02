import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

/**
 * POST /api/sequences/[id]/activate — turn the sequence on and enroll every lead
 * in its list that isn't already enrolled. Each enrollment starts at step 0 and
 * is due immediately; the scheduler (POST /api/sequences/run) fires it from there.
 * Body: { paused?: true } to just pause instead.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const { id } = await params;
    const seq = await prisma.outreachSequence.findFirst({ where: { id, userId: session.userId } });
    if (!seq) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    if (body?.paused) {
      await prisma.outreachSequence.update({ where: { id }, data: { status: "paused" } });
      return NextResponse.json({ success: true, data: { status: "paused" } });
    }

    await prisma.outreachSequence.update({ where: { id }, data: { status: "active" } });

    let enrolled = 0;
    if (seq.listId) {
      const leads = await prisma.savedLead.findMany({ where: { userId: session.userId, listId: seq.listId }, select: { id: true } });
      const existing = await prisma.sequenceEnrollment.findMany({ where: { sequenceId: id }, select: { savedLeadId: true } });
      const already = new Set(existing.map((e) => e.savedLeadId));
      const fresh = leads.filter((l) => !already.has(l.id));
      // Attach the lead's open opportunity to the enrollment when there is one.
      const opps = await prisma.opportunity.findMany({ where: { userId: session.userId, savedLeadId: { in: fresh.map((l) => l.id) } }, select: { id: true, savedLeadId: true } });
      const oppByLead = new Map(opps.map((o) => [o.savedLeadId, o.id]));
      const now = new Date();
      for (const l of fresh) {
        await prisma.sequenceEnrollment.create({ data: { userId: session.userId, sequenceId: id, savedLeadId: l.id, opportunityId: oppByLead.get(l.id) ?? null, currentStep: 0, status: "active", nextRunAt: now } });
        enrolled += 1;
      }
    }
    return NextResponse.json({ success: true, data: { status: "active", enrolled } });
  } catch (error) {
    console.error("Activate sequence error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to activate sequence" } }, { status: 500 });
  }
}
