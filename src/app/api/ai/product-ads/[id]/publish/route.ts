import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { publishAdTake, isAdChannel, type AdChannelId } from "@/lib/product-ads/publish";

/** POST — publish one ad take. Body: { takeId, channels, caption?, scheduleAt? }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const takeId = typeof body?.takeId === "string" ? body.takeId : "";
  if (!takeId) return NextResponse.json({ success: false, error: { message: "Pick a take to publish." } }, { status: 400 });
  const channels = (Array.isArray(body.channels) ? body.channels : []).map((c: unknown) => String(c)).filter(isAdChannel) as AdChannelId[];
  if (!channels.length) return NextResponse.json({ success: false, error: { message: "Pick at least one channel." } }, { status: 400 });
  const parsed = typeof body.scheduleAt === "string" ? new Date(body.scheduleAt) : null;
  const scheduledAt = parsed && !isNaN(parsed.getTime()) && parsed.getTime() > Date.now() ? parsed : null;
  const caption = typeof body.caption === "string" ? body.caption : undefined;

  const res = await publishAdTake({ userId: session.userId, projectId: id, takeId, channels, caption, scheduledAt });
  if (!res.ok) return NextResponse.json({ success: false, error: { message: res.message } }, { status: 400 });
  return NextResponse.json({ success: true, data: { outcomes: res.outcomes } });
}
