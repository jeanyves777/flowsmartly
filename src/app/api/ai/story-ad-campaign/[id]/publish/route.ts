import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCampaign } from "@/lib/story-ad-campaign";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id } = await params;
  const current = await getCampaign(id, session.userId);
  if (!current) {
    return NextResponse.json({ success: false, error: { message: "Campaign not found" } }, { status: 404 });
  }
  if (!current.state.finalVideoUrl) {
    return NextResponse.json(
      { success: false, error: { message: "Final reel is not ready yet." } },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    caption?: string;
    hashtags?: string[];
    platforms?: string[];
    scheduledAt?: string | null;
  };

  const caption = (body.caption || current.state.campaignCaption || "").trim();
  const hashtags = Array.isArray(body.hashtags)
    ? body.hashtags
    : current.state.hashtags || [];
  const platforms = Array.isArray(body.platforms) && body.platforms.length
    ? body.platforms
    : current.state.platforms || ["feed"];

  // Compose final caption with hashtags appended
  const finalText = [caption, hashtags.join(" ")].filter((s) => s && s.length).join("\n\n");

  // Forward cookies so /api/content/posts sees the same session
  const cookie = request.headers.get("cookie") || "";
  const origin = request.nextUrl.origin;

  const payload: Record<string, unknown> = {
    caption: finalText,
    mediaUrls: [current.state.finalVideoUrl],
    // Tell the downstream route this is a video so it picks the right code path
    // (Post.mediaType column + platform publishers branch on this).
    mediaType: "video",
    platforms,
  };
  if (body.scheduledAt) payload.scheduledAt = body.scheduledAt;

  try {
    const res = await fetch(`${origin}/api/content/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("[StoryAdCampaign.publish] non-JSON upstream response", { status: res.status, body: text.slice(0, 500) });
      return NextResponse.json(
        { success: false, error: { message: `Upstream returned ${res.status}: ${text.slice(0, 200)}` } },
        { status: res.status || 500 },
      );
    }
    if (!res.ok || (data && typeof data === "object" && (data as { success?: boolean }).success === false)) {
      console.error("[StoryAdCampaign.publish] upstream error", { status: res.status, payload: data });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    console.error("[StoryAdCampaign.publish] fetch threw:", error);
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
