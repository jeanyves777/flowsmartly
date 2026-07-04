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
    const listId = typeof body.listId === "string" ? body.listId : null;
    const name = (typeof body.name === "string" && body.name.trim()) || "Outreach sequence";
    const steps = JSON.stringify(Array.isArray(body.steps) ? body.steps : []);

    const existing = listId ? await prisma.outreachSequence.findFirst({ where: { userId: session.userId, listId } }) : null;
    const sequence = existing
      ? await prisma.outreachSequence.update({ where: { id: existing.id }, data: { name, steps } })
      : await prisma.outreachSequence.create({ data: { userId: session.userId, name, listId, steps } });
    return NextResponse.json({ success: true, data: { sequence } }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("Create sequence error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to save sequence" } }, { status: 500 });
  }
}
