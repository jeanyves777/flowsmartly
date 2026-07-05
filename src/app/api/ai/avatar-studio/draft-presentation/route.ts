import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { draftPresentation, estimatePresentationCost } from "@/lib/avatar-studio";
import { emptyAvatarState, AVATAR_ASPECTS, AVATAR_QUALITIES, MAX_PRESENTATION_SCENES } from "@/lib/avatar-studio/types";
import type { AvatarAspect, AvatarQuality } from "@/lib/avatar-studio/types";

/** POST — plan a multi-scene presentation from a brief (FREE). Returns the draft id + scenes. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const brief = String(body.brief || "").trim().slice(0, 1200);
  if (brief.length < 4) {
    return NextResponse.json({ success: false, error: { message: "Describe your presentation first." } }, { status: 400 });
  }
  const sceneCount = Math.max(2, Math.min(MAX_PRESENTATION_SCENES, Math.round(Number(body.sceneCount) || 4)));
  const quality: AvatarQuality = AVATAR_QUALITIES.includes(body.quality as AvatarQuality) ? (body.quality as AvatarQuality) : "standard";
  const aspect: AvatarAspect = AVATAR_ASPECTS.includes(body.aspect as AvatarAspect) ? (body.aspect as AvatarAspect) : "9:16";

  const base = {
    ...emptyAvatarState(),
    avatarId: String(body.avatarId || "").trim(),
    avatarName: String(body.avatarName || "Avatar").trim().slice(0, 80),
    voiceId: String(body.voiceId || "").trim(),
    voiceName: String(body.voiceName || "Voice").trim().slice(0, 80),
    quality,
    aspect,
    captionsOn: !!body.captionsOn,
    mode: "presentation" as const,
  };

  const { id, scenes } = await draftPresentation({ userId: session.userId, brief, sceneCount, base });
  const estimatedCredits = await estimatePresentationCost(quality, scenes);
  return NextResponse.json({ success: true, data: { id, scenes, estimatedCredits } });
}
