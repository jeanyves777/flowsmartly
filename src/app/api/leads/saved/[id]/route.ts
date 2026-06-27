import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];
const str = (v: unknown, max = 500): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

// PATCH /api/leads/saved/[id] — edit a saved lead (status, notes, contact fields)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const { id } = await params;

    const existing = await prisma.savedLead.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: { message: "Lead not found" } }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 200);
    if (body.phone !== undefined) data.phone = str(body.phone, 60);
    if (body.website !== undefined) data.website = str(body.website, 400);
    if (body.address !== undefined) data.address = str(body.address);
    if (body.category !== undefined) data.category = str(body.category, 80);
    if (body.notes !== undefined) data.notes = str(body.notes, 4000);
    if (body.listId !== undefined) {
      if (body.listId === null) data.listId = null;
      else {
        const list = await prisma.savedLeadList.findFirst({ where: { id: body.listId, userId: session.userId }, select: { id: true } });
        if (!list) return NextResponse.json({ success: false, error: { message: "List not found" } }, { status: 404 });
        data.listId = body.listId;
      }
    }
    if (typeof body.status === "string") {
      const s = body.status.toUpperCase();
      if (!LEAD_STATUSES.includes(s)) return NextResponse.json({ success: false, error: { message: `status must be one of ${LEAD_STATUSES.join(", ")}` } }, { status: 400 });
      data.status = s;
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ success: false, error: { message: "Nothing to update" } }, { status: 400 });

    const lead = await prisma.savedLead.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: { lead } });
  } catch (error) {
    console.error("Update lead error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update lead" } }, { status: 500 });
  }
}

// DELETE /api/leads/saved/[id] — remove a saved lead
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const { id } = await params;

    const lead = await prisma.savedLead.findFirst({ where: { id, userId: session.userId }, select: { id: true, listId: true } });
    if (!lead) return NextResponse.json({ success: false, error: { message: "Lead not found" } }, { status: 404 });

    await prisma.savedLead.delete({ where: { id } });
    if (lead.listId) {
      const leadCount = await prisma.savedLead.count({ where: { listId: lead.listId } });
      await prisma.savedLeadList.update({ where: { id: lead.listId }, data: { leadCount } }).catch(() => {});
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete lead error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete lead" } }, { status: 500 });
  }
}
