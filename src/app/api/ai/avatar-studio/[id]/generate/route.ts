import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateDraftScene } from "@/lib/avatar-studio";

/** POST — generate a drafted scene: charge credits, then render it with HeyGen. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id } = await params;
  const result = await generateDraftScene(id, session.userId, !!session.adminId);
  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : result.code === "insufficient_credits" ? 402 : 400;
    return NextResponse.json({ success: false, error: { code: result.code, message: result.message } }, { status });
  }
  return NextResponse.json({ success: true, data: { id: result.id, creditsCost: result.creditsCost } });
}
