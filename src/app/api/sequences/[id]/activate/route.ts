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

    let enrolled = 0;
    let skipped = 0;
    let total = 0;
    if (seq.listId) {
      const leads = await prisma.savedLead.findMany({ where: { userId: session.userId, listId: seq.listId }, select: { id: true, email: true, phone: true } });
      total = leads.length;
      // Only enroll leads we can actually REACH — an email OR a phone. Leads with
      // neither are excluded so the sequence never tries to send into the void
      // (that's what breaks the pipeline). If none are reachable, refuse to turn
      // it on and tell the UI to enrich first.
      const reachable = leads.filter((l) => (l.email && l.email.trim()) || (l.phone && l.phone.trim()));
      skipped = leads.length - reachable.length;
      if (reachable.length === 0) {
        await prisma.outreachSequence.update({ where: { id }, data: { status: "draft" } });
        return NextResponse.json({
          success: false,
          error: { message: `None of these ${total} leads have an email or phone yet — enrich the list first, then turn the automation on.`, code: "no_reachable_leads" },
          data: { status: "draft", total, reachable: 0, skipped },
        }, { status: 422 });
      }

      await prisma.outreachSequence.update({ where: { id }, data: { status: "active" } });

      const existing = await prisma.sequenceEnrollment.findMany({ where: { sequenceId: id }, select: { savedLeadId: true } });
      const already = new Set(existing.map((e) => e.savedLeadId));
      const fresh = reachable.filter((l) => !already.has(l.id));
      // Attach the lead's open opportunity to the enrollment when there is one.
      const opps = await prisma.opportunity.findMany({ where: { userId: session.userId, savedLeadId: { in: fresh.map((l) => l.id) } }, select: { id: true, savedLeadId: true } });
      const oppByLead = new Map(opps.map((o) => [o.savedLeadId, o.id]));
      const now = new Date();
      for (const l of fresh) {
        await prisma.sequenceEnrollment.create({ data: { userId: session.userId, sequenceId: id, savedLeadId: l.id, opportunityId: oppByLead.get(l.id) ?? null, currentStep: 0, status: "active", nextRunAt: now } });
        enrolled += 1;
      }
    } else {
      await prisma.outreachSequence.update({ where: { id }, data: { status: "active" } });
    }
    return NextResponse.json({ success: true, data: { status: "active", enrolled, skipped, total } });
  } catch (error) {
    console.error("Activate sequence error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to activate sequence" } }, { status: 500 });
  }
}
