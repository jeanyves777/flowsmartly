import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { ensureDefaultStages } from "@/lib/crm/pipeline";

// GET /api/opportunities — the user's deals (optionally ?status=open|won|lost).
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const status = request.nextUrl.searchParams.get("status") || undefined;

    const [stages, opportunities] = await Promise.all([
      ensureDefaultStages(session.userId),
      prisma.opportunity.findMany({
        where: { userId: session.userId, ...(status ? { status } : {}) },
        orderBy: { updatedAt: "desc" },
        include: {
          savedLead: { select: { id: true, name: true, title: true, email: true } },
          company: { select: { id: true, name: true, domain: true } },
        },
      }),
    ]);
    return NextResponse.json({ success: true, data: { stages, opportunities } });
  } catch (error) {
    console.error("List opportunities error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load opportunities" } }, { status: 500 });
  }
}

// POST /api/opportunities — create a deal { title, value?, stageId?, savedLeadId?, companyId?, source?, expectedCloseAt?, probability? }
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const body = await request.json();
    const title = String(body.title || "").trim();
    if (!title) return NextResponse.json({ success: false, error: { message: "title is required" } }, { status: 400 });

    const stages = await ensureDefaultStages(session.userId);
    const stage = (typeof body.stageId === "string" && stages.find((s) => s.id === body.stageId)) || stages[0];
    const stageId = stage?.id ?? null;
    // If the deal is created directly in a Won/Lost stage, resolve it now.
    const status = stage?.isWon ? "won" : stage?.isLost ? "lost" : "open";

    const opportunity = await prisma.opportunity.create({
      data: {
        userId: session.userId,
        title: title.slice(0, 200),
        value: Number.isFinite(Number(body.value)) ? Number(body.value) : 0,
        currency: typeof body.currency === "string" ? body.currency.slice(0, 8) : "USD",
        stageId,
        status,
        closedAt: status === "open" ? null : new Date(),
        probability: Math.min(100, Math.max(0, Number(body.probability) || 0)),
        source: typeof body.source === "string" ? body.source.slice(0, 40) : "manual",
        savedLeadId: typeof body.savedLeadId === "string" ? body.savedLeadId : null,
        companyId: typeof body.companyId === "string" ? body.companyId : null,
        pitchId: typeof body.pitchId === "string" ? body.pitchId : null,
        expectedCloseAt: body.expectedCloseAt ? new Date(body.expectedCloseAt) : null,
      },
    });
    // Log the creation on the timeline.
    await prisma.activity.create({
      data: { userId: session.userId, type: "note", subject: "Opportunity created", opportunityId: opportunity.id, savedLeadId: opportunity.savedLeadId },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: { opportunity } }, { status: 201 });
  } catch (error) {
    console.error("Create opportunity error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to create opportunity" } }, { status: 500 });
  }
}
