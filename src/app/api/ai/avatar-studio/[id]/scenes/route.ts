import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAvatarVideo, updatePresentationScenes, estimatePresentationCost } from "@/lib/avatar-studio";
import type { PresentationScene } from "@/lib/avatar-studio/types";

/** PATCH — replace a presentation's scene list (free). Returns the saved scenes + live credit estimate. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { scenes?: unknown };
  const scenes = Array.isArray(body.scenes) ? (body.scenes as PresentationScene[]) : [];

  const ok = await updatePresentationScenes(id, session.userId, scenes);
  if (!ok) {
    return NextResponse.json({ success: false, error: { message: "Could not update scenes (not a draft presentation)." } }, { status: 400 });
  }
  const found = await getAvatarVideo(id, session.userId);
  const saved = found?.state.scenes ?? [];
  const estimatedCredits = await estimatePresentationCost(found?.state.quality ?? "standard", saved);
  return NextResponse.json({ success: true, data: { scenes: saved, estimatedCredits } });
}
