import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createReelPost, listPostsForCampaign, type ReelPostContent } from "@/lib/reel/reel-editor";
import { isReelChannel, type ReelChannelId } from "@/lib/reel/highlights";

// POST /api/reels/[id]/publish — post/schedule clips to reel-capable channels.
// Body: { clipIds: string[], channels: string[], scheduleAt?: ISO }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const clipIds = (Array.isArray(body.clipIds) ? body.clipIds : []).map((c) => String(c)).filter(Boolean);
    const channels = (Array.isArray(body.channels) ? body.channels : []).map((c) => String(c)).filter(isReelChannel) as ReelChannelId[];
    if (!clipIds.length || !channels.length) {
      return NextResponse.json({ error: "clipIds and channels are required" }, { status: 400 });
    }
    const scheduledAt = typeof body.scheduleAt === "string" && body.scheduleAt ? new Date(body.scheduleAt) : null;
    const valid = scheduledAt && !isNaN(scheduledAt.getTime()) ? scheduledAt : null;

    const created: ReelPostContent[] = [];
    for (const clipId of clipIds) {
      for (const channel of channels) {
        try {
          created.push(await createReelPost({ userId: session.userId, clipId, channel, scheduledAt: valid }));
        } catch {
          /* skip clips the user doesn't own */
        }
      }
    }
    const posts = await listPostsForCampaign(id, session.userId);
    return NextResponse.json({ created: created.length, mode: valid ? "scheduled" : "posting", posts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Publish failed" }, { status: 400 });
  }
}
