import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateSceneBackground } from "@/lib/avatar-studio";
import { AVATAR_ASPECTS } from "@/lib/avatar-studio/types";
import type { AvatarAspect } from "@/lib/avatar-studio/types";

/** POST — generate a scene background with our own AI image tool → returns a public URL. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { prompt?: string; aspect?: string };
  const prompt = String(body.prompt || "").trim().slice(0, 400);
  if (prompt.length < 3) {
    return NextResponse.json({ success: false, error: { message: "Describe the background you want." } }, { status: 400 });
  }
  const aspect: AvatarAspect = AVATAR_ASPECTS.includes(body.aspect as AvatarAspect) ? (body.aspect as AvatarAspect) : "9:16";
  const url = await generateSceneBackground(session.userId, prompt, aspect);
  if (!url) {
    return NextResponse.json({ success: false, error: { message: "Background generation failed." } }, { status: 502 });
  }
  return NextResponse.json({ success: true, data: { url } });
}
