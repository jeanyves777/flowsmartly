import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getNarration, saveNarration } from "@/lib/voice-studio/store";
import { generateNarrationCast } from "@/lib/voice-studio/engines";
import { normalizeCharacter } from "@/lib/video-director/types";

/** POST — build this subject's anchor (portrait + turnaround sheet). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; characterId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, characterId } = await params;
  const body = (await request.json().catch(() => ({}))) as { baseImageUrl?: string | null };
  const project = await generateNarrationCast(id, session.userId, characterId, { baseImageUrl: body.baseImageUrl });
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  return NextResponse.json({ success: true, data: await presignAllUrls({ project }) });
}

/** PATCH — approve / rename / re-describe a subject. Free. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; characterId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, characterId } = await params;
  const patch = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const project = await getNarration(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  const i = project.characters.findIndex((c) => c.id === characterId);
  if (i < 0) return NextResponse.json({ success: false, error: { message: "No such subject" } }, { status: 404 });
  project.characters[i] = normalizeCharacter({ ...project.characters[i], ...patch }, i);
  await saveNarration(id, session.userId, project);
  return NextResponse.json({ success: true, data: await presignAllUrls({ project }) });
}

/** DELETE — drop a subject the story does not need. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; characterId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, characterId } = await params;
  const project = await getNarration(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  project.characters = project.characters.filter((c) => c.id !== characterId);
  // Unhook them from every shot too, or that shot would render an unanchored stranger.
  project.shots = project.shots.map((s) => ({ ...s, cast: s.cast.filter((c) => c !== characterId) }));
  await saveNarration(id, session.userId, project);
  return NextResponse.json({ success: true, data: await presignAllUrls({ project }) });
}
