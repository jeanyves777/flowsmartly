import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getAvatarVideo, deleteAvatarVideo } from "@/lib/avatar-studio";

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
