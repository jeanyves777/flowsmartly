import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/leads/lists — the user's saved lead lists (name, category, count)
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const lists = await prisma.savedLeadList.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, category: true, leadCount: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ success: true, data: { lists } });
  } catch (error) {
    console.error("List lead-lists error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load lead lists" } }, { status: 500 });
  }
}

// POST /api/leads/lists — create an empty lead list { name, category? }
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: { message: "List name is required" } }, { status: 400 });
    const category = String(body.category || "").trim() || null;

    const list = await prisma.savedLeadList.create({
      data: { userId: session.userId, name: name.slice(0, 120), category: category?.slice(0, 80) ?? null },
      select: { id: true, name: true, category: true, leadCount: true },
    });
    return NextResponse.json({ success: true, data: { list } }, { status: 201 });
  } catch (error) {
    console.error("Create lead-list error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to create list" } }, { status: 500 });
  }
}
