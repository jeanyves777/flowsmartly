import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import {
  startAvatarVideo,
  listAvatarVideos,
} from "@/lib/avatar-studio";
import { emptyAvatarState } from "@/lib/avatar-studio/types";
import { AVATAR_ASPECTS, AVATAR_QUALITIES, AVATAR_MODES } from "@/lib/avatar-studio/types";
import type { AvatarAspect, AvatarQuality, AvatarMode } from "@/lib/avatar-studio/types";

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** POST — create + charge + start a HeyGen avatar render. Returns immediately. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const base = emptyAvatarState();
  const lengthSeconds = [15, 30, 60].includes(Number(body.lengthSeconds)) ? Number(body.lengthSeconds) : 30;

  const state = {
    ...base,
    brief: String(body.brief || "").trim().slice(0, 1200),
    script: String(body.script || "").trim().slice(0, 3500),
    avatarId: String(body.avatarId || "").trim(),
    avatarName: String(body.avatarName || "Avatar").trim().slice(0, 80),
    voiceId: String(body.voiceId || "").trim(),
    voiceName: String(body.voiceName || "Voice").trim().slice(0, 80),
    quality: pick<AvatarQuality>(body.quality, AVATAR_QUALITIES, "standard"),
    aspect: pick<AvatarAspect>(body.aspect, AVATAR_ASPECTS, "9:16"),
    lengthSeconds,
    mode: pick<AvatarMode>(body.mode, AVATAR_MODES, "talking"),
    templateId: body.templateId ? String(body.templateId).slice(0, 80) : null,
    // Translate mode: source video + target language.
    sourceVideoUrl: body.sourceVideoUrl ? String(body.sourceVideoUrl).trim().slice(0, 2000) : null,
    targetLanguage: body.targetLanguage ? String(body.targetLanguage).trim().slice(0, 40) : null,
  };

  const result = await startAvatarVideo({ userId: session.userId, isAdmin: !!session.adminId, state });
  if (!result.ok) {
    const status = result.code === "insufficient_credits" ? 402 : 400;
    return NextResponse.json({ success: false, error: { code: result.code, message: result.message } }, { status });
  }
  return NextResponse.json({ success: true, data: { id: result.id, creditsCost: result.creditsCost } });
}

/** GET — list the user's avatar videos for the playground canvas. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const items = await listAvatarVideos(session.userId, 24);
  return NextResponse.json({ success: true, data: await presignAllUrls({ videos: items }) });
}
