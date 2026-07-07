import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { applyClipUpdate, type ClipPatch } from "@/lib/reel/reel-editor";
import type { ReelAspect, CaptionWord } from "@/lib/reel/highlights";

// PATCH /api/reels/clips/[id] — edit one clip (title/hook/hashtags/aspect/order/caption).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const patch: ClipPatch = {};
    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.hook === "string") patch.hook = body.hook;
    if (Array.isArray(body.hashtags)) patch.hashtags = body.hashtags.map((h) => String(h));
    if (body.aspect === "9:16" || body.aspect === "1:1" || body.aspect === "16:9") patch.aspect = body.aspect as ReelAspect;
    if (typeof body.order === "number") patch.order = body.order;
    if (Array.isArray(body.caption)) patch.caption = body.caption as CaptionWord[];

    const clip = await applyClipUpdate({ clipId: id, userId: session.userId, patch });
    return NextResponse.json({ clip });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: msg === "Clip not found" ? 404 : 400 });
  }
}
