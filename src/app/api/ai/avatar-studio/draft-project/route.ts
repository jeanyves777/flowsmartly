import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { draftAvatarProject } from "@/lib/avatar-studio";
import { emptyAvatarState, AVATAR_ASPECTS, AVATAR_QUALITIES } from "@/lib/avatar-studio/types";
import type { AvatarAspect, AvatarQuality } from "@/lib/avatar-studio/types";

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * POST — draft an N-scene talking-avatar project from a brief. Writes the
 * scripts (LLM) and creates N DRAFT scenes on the playground for the user to
 * review, edit, and generate. Drafting is free; generating each scene charges.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const brief = String(body.brief || "").trim().slice(0, 1200);
  if (brief.length < 6) {
    return NextResponse.json({ success: false, error: { message: "Tell us what the video series is about." } }, { status: 400 });
  }
  const sceneCount = Math.max(1, Math.min(10, Math.round(Number(body.sceneCount) || 1)));
  const avatarId = String(body.avatarId || "").trim();
  const voiceId = String(body.voiceId || "").trim();
  if (!avatarId || !voiceId) {
    return NextResponse.json({ success: false, error: { message: "Pick an avatar and voice for the scenes." } }, { status: 400 });
  }
  const lengthSeconds = [15, 30, 60].includes(Number(body.lengthSeconds)) ? Number(body.lengthSeconds) : 30;

  const base = {
    ...emptyAvatarState(),
    avatarId,
    avatarName: String(body.avatarName || "Avatar").trim().slice(0, 80),
    voiceId,
    voiceName: String(body.voiceName || "Voice").trim().slice(0, 80),
    quality: pick<AvatarQuality>(body.quality, AVATAR_QUALITIES, "standard"),
    aspect: pick<AvatarAspect>(body.aspect, AVATAR_ASPECTS, "9:16"),
    lengthSeconds,
    projectId: body.projectId ? String(body.projectId).slice(0, 60) : null,
  };

  const result = await draftAvatarProject({ userId: session.userId, brief, sceneCount, base });
  return NextResponse.json({ success: true, data: result });
}
