import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// The agent-canvas design library. Reuses the existing Design table (no schema
// change) with a dedicated category so it never mixes with legacy Studio designs.
const CATEGORY = "agent_canvas";

function safeParse(s: string | null): unknown {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

// GET /api/agent-designs — list the user's saved canvas designs (newest first).
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }
    const rows = await prisma.design.findMany({
      where: { userId: session.userId, category: CATEGORY },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, name: true, size: true, style: true, imageUrl: true, canvasData: true, updatedAt: true },
    });
    const designs = rows.map((r) => ({
      id: r.id,
      name: r.name,
      size: r.size,
      style: r.style,
      imageUrl: r.imageUrl,
      updatedAt: r.updatedAt.toISOString(),
      doc: safeParse(r.canvasData),
    }));
    return NextResponse.json({ success: true, data: { designs } });
  } catch (error) {
    console.error("List agent designs error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load designs" } }, { status: 500 });
  }
}

// POST /api/agent-designs — save the current canvas as a new design.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }
    const body = await request.json();
    const doc = body?.doc as Record<string, unknown> | undefined;
    if (!doc || typeof doc !== "object") {
      return NextResponse.json({ success: false, error: { message: "doc is required" } }, { status: 400 });
    }
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : "Untitled design";
    const design = await prisma.design.create({
      data: {
        userId: session.userId,
        category: CATEGORY,
        type: "image",
        status: "COMPLETED",
        prompt: (typeof doc.headline === "string" ? doc.headline : "").slice(0, 300),
        name,
        size: typeof doc.size === "string" ? doc.size : "1080×1350",
        style: typeof doc.style === "string" ? doc.style : null,
        imageUrl: typeof doc.imageUrl === "string" ? doc.imageUrl : null,
        canvasData: JSON.stringify(doc),
      },
      select: { id: true, name: true, updatedAt: true },
    });
    return NextResponse.json({ success: true, data: { design: { id: design.id, name: design.name, updatedAt: design.updatedAt.toISOString() } } });
  } catch (error) {
    console.error("Create agent design error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to save design" } }, { status: 500 });
  }
}
