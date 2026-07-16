import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getNarration, saveNarration } from "@/lib/voice-studio/store";
import { generateTakes } from "@/lib/voice-studio/engines";

/** POST — read the whole script N times (voiceover mode). Each take lands on the canvas. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { script?: string; takeCount?: number };

  const project = await getNarration(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  if (body.script !== undefined || body.takeCount !== undefined) {
    if (body.script !== undefined) project.script = body.script;
    if (body.takeCount !== undefined) project.takeCount = body.takeCount;
    await saveNarration(id, session.userId, project);
  }
  const res = await generateTakes(id, session.userId);
  if (!res.ok) return NextResponse.json({ success: false, error: { message: res.message || "Could not start." } }, { status: 400 });
  const fresh = await getNarration(id, session.userId);
  return NextResponse.json({ success: true, data: await presignAllUrls({ project: fresh }) });
}
