import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const CATEGORY = "agent_canvas";

function safeParse(s: string | null): unknown {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

// GET /api/agent-designs/[id] — load one saved design (with its full doc).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const d = await prisma.design.findFirst({
      where: { id, userId: session.userId, category: CATEGORY },
      select: { id: true, name: true, canvasData: true, updatedAt: true },
    });
    if (!d) return NextResponse.json({ success: false, error: { message: "Design not found" } }, { status: 404 });
    return NextResponse.json({ success: true, data: { design: { id: d.id, name: d.name, doc: safeParse(d.canvasData), updatedAt: d.updatedAt.toISOString() } } });
  } catch (error) {
    console.error("Get agent design error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load design" } }, { status: 500 });
  }
}

// PATCH /api/agent-designs/[id] — overwrite a saved design (and/or rename it).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const existing = await prisma.design.findFirst({ where: { id, userId: session.userId, category: CATEGORY }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: { message: "Design not found" } }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 120);
    const doc = body?.doc as Record<string, unknown> | undefined;
    if (doc && typeof doc === "object") {
      data.canvasData = JSON.stringify(doc);
      if (typeof doc.size === "string") data.size = doc.size;
      data.style = typeof doc.style === "string" ? doc.style : null;
      data.imageUrl = typeof doc.imageUrl === "string" ? doc.imageUrl : null;
      if (typeof doc.headline === "string") data.prompt = doc.headline.slice(0, 300);
    }
    const updated = await prisma.design.update({ where: { id }, data, select: { id: true, name: true, updatedAt: true } });
    return NextResponse.json({ success: true, data: { design: { id: updated.id, name: updated.name, updatedAt: updated.updatedAt.toISOString() } } });
  } catch (error) {
    console.error("Update agent design error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update design" } }, { status: 500 });
  }
}

// DELETE /api/agent-designs/[id] — remove a saved design.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const existing = await prisma.design.findFirst({ where: { id, userId: session.userId, category: CATEGORY }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: { message: "Design not found" } }, { status: 404 });
    await prisma.design.delete({ where: { id } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("Delete agent design error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete design" } }, { status: 500 });
  }
}
