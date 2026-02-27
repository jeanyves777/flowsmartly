import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { updateCursor, updateSelection, broadcastToDesign } from "@/lib/designs/presence";

// POST /api/designs/[id]/presence/cursor — Update cursor position
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

    const body = await request.json();
    const { sessionKey, x, y, pageIndex, selectedObjectId } = body;
    if (!sessionKey) {
      return NextResponse.json({ success: false, error: { message: "Missing sessionKey" } }, { status: 400 });
    }

    // Handle selection change (soft object locking)
    if (selectedObjectId !== undefined) {
      updateSelection(designId, sessionKey, selectedObjectId);
      broadcastToDesign(
        designId,
        "selection:change",
        { userId: session.userId, selectedObjectId },
        sessionKey
      );
    }

    // Handle cursor position update
    if (typeof x === "number" && typeof y === "number") {
      const cursor = { x, y, pageIndex: pageIndex ?? 0 };
      updateCursor(designId, sessionKey, cursor);

      broadcastToDesign(
        designId,
        "cursor:move",
        { userId: session.userId, cursor },
        sessionKey
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cursor update error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal error" } }, { status: 500 });
  }
}
