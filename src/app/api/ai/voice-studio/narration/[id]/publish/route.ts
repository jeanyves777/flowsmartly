import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { publishNarration, type NarrationChannelId } from "@/lib/voice-studio/publish";

/** POST — publish (or schedule) the finished narrated film. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { channels?: string[]; caption?: string; scheduleAt?: string | null };

  const res = await publishNarration({
    userId: session.userId,
    narrationId: id,
    channels: (body.channels || []) as NarrationChannelId[],
    caption: body.caption,
    scheduledAt: body.scheduleAt ? new Date(body.scheduleAt) : null,
  });
  if (!res.ok && res.outcomes.length === 0) {
    return NextResponse.json({ success: false, error: { message: res.message || "Could not publish." } }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: { results: res.outcomes, message: res.message } });
}
