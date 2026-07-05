import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getAvatarVideo, deleteAvatarVideo, updateDraftScript, updateDraftScene } from "@/lib/avatar-studio";
import { AVATAR_ASPECTS, AVATAR_QUALITIES, isAvatarLength, MAX_SCRIPT_CHARS } from "@/lib/avatar-studio/types";
import type { AvatarVideoState, AvatarAspect, AvatarQuality } from "@/lib/avatar-studio/types";

/** GET — one avatar video's detail (status, progress, state) for the drawer. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id } = await params;
  const found = await getAvatarVideo(id, session.userId);
  if (!found) {
    return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  }
  const { row, state } = found;
  const data = await presignAllUrls({
    id: row.id,
    status: row.status,
    progress: row.progress,
    currentStep: row.currentStep,
    videoUrl: row.videoUrl,
    thumbnailUrl: row.thumbnailUrl,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    state,
  });
  return NextResponse.json({ success: true, data });
}

/** PATCH — edit a draft scene: just the script, or the full editor settings. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Script-only quick edit.
  const keys = Object.keys(body);
  if (keys.length === 1 && keys[0] === "script") {
    if (typeof body.script !== "string" || !body.script.trim()) {
      return NextResponse.json({ success: false, error: { message: "Script is required." } }, { status: 400 });
    }
    const ok = await updateDraftScript(id, session.userId, body.script);
    return ok
      ? NextResponse.json({ success: true, data: { updated: true } })
      : NextResponse.json({ success: false, error: { message: "Only draft scenes can be edited." } }, { status: 400 });
  }

  // Full editor-settings patch (whitelisted).
  const patch: Partial<AvatarVideoState> = {};
  if (typeof body.script === "string" && body.script.trim()) patch.script = body.script.trim().slice(0, MAX_SCRIPT_CHARS);
  if (typeof body.avatarId === "string" && body.avatarId) patch.avatarId = body.avatarId;
  if (typeof body.avatarName === "string") patch.avatarName = body.avatarName.slice(0, 80);
  if (typeof body.voiceId === "string" && body.voiceId) patch.voiceId = body.voiceId;
  if (typeof body.voiceName === "string") patch.voiceName = body.voiceName.slice(0, 80);
  if (AVATAR_QUALITIES.includes(body.quality as AvatarQuality)) patch.quality = body.quality as AvatarQuality;
  if (AVATAR_ASPECTS.includes(body.aspect as AvatarAspect)) patch.aspect = body.aspect as AvatarAspect;
  if (isAvatarLength(body.lengthSeconds)) patch.lengthSeconds = Number(body.lengthSeconds);
  if (typeof body.captionsOn === "boolean") patch.captionsOn = body.captionsOn;
  if (typeof body.captionStyle === "string") patch.captionStyle = body.captionStyle.slice(0, 40);
  if (typeof body.background === "string") patch.background = body.background.slice(0, 2048);
  if (typeof body.layout === "string") patch.layout = body.layout.slice(0, 20);
  if (typeof body.music === "string" || body.music === null) patch.music = body.music ? String(body.music).slice(0, 60) : null;
  if (typeof body.templateId === "string" || body.templateId === null) patch.templateId = body.templateId ? String(body.templateId).slice(0, 80) : null;

  const ok = await updateDraftScene(id, session.userId, patch);
  return ok
    ? NextResponse.json({ success: true, data: { updated: true } })
    : NextResponse.json({ success: false, error: { message: "Only draft scenes can be edited." } }, { status: 400 });
}

/** DELETE — remove an avatar video (guarded by animationType inside the lib). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteAvatarVideo(id, session.userId);
  if (!ok) {
    return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: { deleted: true } });
}
