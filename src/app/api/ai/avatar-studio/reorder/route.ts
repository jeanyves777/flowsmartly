import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { reorderProjectScenes } from "@/lib/avatar-studio";

/** POST — reorder a project's scenes by the given id order (drag-and-drop). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { orderedIds?: unknown };
  const orderedIds = Array.isArray(body.orderedIds)
    ? (body.orderedIds as unknown[]).map((x) => String(x)).filter(Boolean).slice(0, 50)
    : [];
  if (orderedIds.length === 0) {
    return NextResponse.json({ success: false, error: { message: "No scene order provided." } }, { status: 400 });
  }
  await reorderProjectScenes(session.userId, orderedIds);
  return NextResponse.json({ success: true, data: { reordered: orderedIds.length } });
}
