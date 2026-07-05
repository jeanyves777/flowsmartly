import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { startAvatarVideoBatch } from "@/lib/avatar-studio";
import { emptyAvatarState, AVATAR_ASPECTS, AVATAR_QUALITIES } from "@/lib/avatar-studio/types";
import type { AvatarAspect, AvatarQuality } from "@/lib/avatar-studio/types";

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * POST — batch-render many talking-avatar videos, one per script line, all
 * with the same avatar/voice/quality/format. Body: { scripts: string[],
 * avatarId, avatarName, voiceId, voiceName, quality, aspect, lengthSeconds }.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const scripts = Array.isArray(body.scripts)
    ? (body.scripts as unknown[]).map((s) => String(s || "")).filter((s) => s.trim())
    : [];
  if (scripts.length === 0) {
    return NextResponse.json({ success: false, error: { message: "Add at least one script line." } }, { status: 400 });
  }
  const avatarId = String(body.avatarId || "").trim();
  const voiceId = String(body.voiceId || "").trim();
  if (!avatarId || !voiceId) {
    return NextResponse.json({ success: false, error: { message: "Pick a default avatar and voice for the batch." } }, { status: 400 });
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

  const result = await startAvatarVideoBatch({ userId: session.userId, isAdmin: !!session.adminId, scripts, base });
  if (result.error && result.started.length === 0) {
    const status = /credit/i.test(result.error) ? 402 : 400;
    return NextResponse.json({ success: false, error: { message: result.error } }, { status });
  }
  return NextResponse.json({
    success: true,
    data: { started: result.started.length, totalCredits: result.totalCredits, partialError: result.error || null },
  });
}
