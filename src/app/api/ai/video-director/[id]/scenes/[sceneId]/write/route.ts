import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { writeDirectorScene, type SceneWriteMode } from "@/lib/video-director/scene-writer";

/** POST — contextually write or improve one AI scene's shot prompt/dialogue. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, sceneId } = await params;
  const body = (await request.json().catch(() => ({}))) as { mode?: SceneWriteMode; instruction?: string };
  const mode: SceneWriteMode = body.mode === "prompt" ? "prompt" : "scene";
  try {
    const result = await writeDirectorScene(id, session.userId, sceneId, mode, String(body.instruction || ""));
    if (!result.ok) return NextResponse.json({ success: false, error: { message: result.message || "Scene writing failed" } }, { status: 400 });
    const data = await presignAllUrls({ film: result.film });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Scene writing failed" } },
      { status: 500 },
    );
  }
}
