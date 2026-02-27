import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canEditDesign } from "@/lib/designs/access";
import { broadcastToDesign } from "@/lib/designs/presence";

// POST /api/designs/[id]/presence/broadcast — Broadcast canvas operations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    // Only editors can broadcast canvas changes
    const isEditor = await canEditDesign(designId, session.userId);
    if (!isEditor) {
      return NextResponse.json({ success: false, error: { message: "View-only access" } }, { status: 403 });
    }

    const { sessionKey, operation } = await request.json();
    if (!sessionKey || !operation) {
      return NextResponse.json({ success: false, error: { message: "Invalid operation" } }, { status: 400 });
    }

    // Broadcast to all clients except sender
    broadcastToDesign(
      designId,
      "canvas:op",
      { operation },
      sessionKey
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Broadcast error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal error" } }, { status: 500 });
  }
}
