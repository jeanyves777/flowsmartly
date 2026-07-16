import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { rewriteShotLine } from "@/lib/voice-studio/draft";

/** POST — rewrite ONE beat of narration and re-time its shot. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; shotId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, shotId } = await params;
  const { instruction } = (await request.json().catch(() => ({}))) as { instruction?: string };
  if (!instruction?.trim()) {
    return NextResponse.json({ success: false, error: { message: "Say how to change it." } }, { status: 400 });
  }
  const project = await rewriteShotLine(id, session.userId, shotId, instruction.trim());
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  return NextResponse.json({ success: true, data: await presignAllUrls({ project }) });
}
