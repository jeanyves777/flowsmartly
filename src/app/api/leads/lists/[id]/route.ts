import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

function parseArr(json: string | null | undefined): string[] {
  if (!json) return [];
  try { const p = JSON.parse(json); return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : []; } catch { return []; }
}

// GET /api/leads/lists/[id] — a list + its leads
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const { id } = await params;

    const list = await prisma.savedLeadList.findFirst({
      where: { id, userId: session.userId },
      select: { id: true, name: true, category: true, leadCount: true },
    });
    if (!list) return NextResponse.json({ success: false, error: { message: "List not found" } }, { status: 404 });

    const leads = await prisma.savedLead.findMany({
      where: { listId: id, userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, address: true, phone: true, website: true, rating: true, reviewCount: true,
        businessStatus: true, category: true, types: true, googleMapsUrl: true, status: true, notes: true, createdAt: true,
        title: true, seniority: true, department: true, email: true, phones: true, socials: true, enrichedAt: true,
        enrichmentSource: true, enrichment: true, deepEnrichedAt: true,
        _count: { select: { pitches: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        list,
        leads: leads.map((l) => ({ ...l, types: parseArr(l.types), pitchCount: l._count.pitches, _count: undefined })),
      },
    });
  } catch (error) {
    console.error("Get lead-list error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load list" } }, { status: 500 });
  }
}

// PATCH /api/leads/lists/[id] — rename / re-categorize
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const { id } = await params;

    const existing = await prisma.savedLeadList.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: { message: "List not found" } }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 120);
    if (body.category !== undefined) data.category = String(body.category || "").trim().slice(0, 80) || null;
    if (Object.keys(data).length === 0) return NextResponse.json({ success: false, error: { message: "Nothing to update" } }, { status: 400 });

    const list = await prisma.savedLeadList.update({ where: { id }, data, select: { id: true, name: true, category: true, leadCount: true } });
    return NextResponse.json({ success: true, data: { list } });
  } catch (error) {
    console.error("Update lead-list error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update list" } }, { status: 500 });
  }
}

// DELETE /api/leads/lists/[id] — delete the list AND its leads
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const { id } = await params;

    const existing = await prisma.savedLeadList.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: { message: "List not found" } }, { status: 404 });

    await prisma.$transaction([
      prisma.savedLead.deleteMany({ where: { listId: id, userId: session.userId } }),
      prisma.savedLeadList.delete({ where: { id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete lead-list error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete list" } }, { status: 500 });
  }
}
