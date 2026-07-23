import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/sequences?listId= — the sequence for a list (or all the user's sequences).
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const listId = request.nextUrl.searchParams.get("listId");
    if (listId) {
      const sequence = await prisma.outreachSequence.findFirst({ where: { userId: session.userId, listId }, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ success: true, data: { sequence } });
    }
    const sequences = await prisma.outreachSequence.findMany({ where: { userId: session.userId }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ success: true, data: { sequences } });
  } catch (error) {
    console.error("List sequences error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load sequences" } }, { status: 500 });
  }
}

// POST /api/sequences — create or upsert (by listId) a sequence { listId?, name?, steps }.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const body = await request.json();
    const listId = typeof body.listId === "string" && body.listId ? body.listId : null;
    const contactListId = typeof body.contactListId === "string" && body.contactListId ? body.contactListId : null;
    const audienceKind = body.audienceKind === "contact" ? "contact" : listId ? "lead" : "contact";
    const name = (typeof body.name === "string" && body.name.trim()) || "Follow-up campaign";
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    const steps = JSON.stringify(Array.isArray(body.steps) ? body.steps : []);
    const recurring = !!body.recurring;
    const recurrenceDays = Math.max(0, Math.min(365, Number(body.recurrenceDays) || 0));
    const data = { name, goal, steps, audienceKind, listId, contactListId, recurring, recurrenceDays };

    // Update by explicit id (owned), else upsert by list/contact-list, else create.
    let existing = null;
    if (typeof body.id === "string" && body.id) {
      existing = await prisma.outreachSequence.findFirst({ where: { id: body.id, userId: session.userId } });
    } else if (listId) {
      existing = await prisma.outreachSequence.findFirst({ where: { userId: session.userId, listId } });
    } else if (contactListId) {
      existing = await prisma.outreachSequence.findFirst({ where: { userId: session.userId, contactListId } });
    }

    const sequence = existing
      ? await prisma.outreachSequence.update({ where: { id: existing.id }, data })
      : await prisma.outreachSequence.create({ data: { userId: session.userId, ...data } });
    return NextResponse.json({ success: true, data: { sequence } }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("Create sequence error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to save sequence" } }, { status: 500 });
  }
}
