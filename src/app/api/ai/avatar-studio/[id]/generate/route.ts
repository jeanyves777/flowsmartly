import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateDraftScene, generatePresentationRender, getAvatarVideo } from "@/lib/avatar-studio";

/** POST — render a draft: a single scene, or (presentation mode) the whole stitched video. Charges credits. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id } = await params;
  const found = await getAvatarVideo(id, session.userId);
  const result = found?.state.mode === "presentation"
    ? await generatePresentationRender(id, session.userId, !!session.adminId)
    : await generateDraftScene(id, session.userId, !!session.adminId);
  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : result.code === "insufficient_credits" ? 402 : 400;
    return NextResponse.json({ success: false, error: { code: result.code, message: result.message } }, { status });
  }
  return NextResponse.json({ success: true, data: { id: result.id, creditsCost: result.creditsCost } });
}
