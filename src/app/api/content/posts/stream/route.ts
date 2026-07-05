import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { extractS3Key } from "@/lib/utils/s3-client";
import { publishToSocialPlatforms, type PublishProgress } from "@/lib/social/publisher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Streaming publish — creates the post, then emits per-channel progress over SSE
 * so the composer can render a live "publishing to N channels" modal (and the
 * agent panel can narrate it) instead of one blocking button spinner.
 *
 * Events: created → (channel_start · channel_stage · channel_result)* → done | error
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const caption: string = (body.caption || "").toString();
  const mediaUrls: string[] = Array.isArray(body.mediaUrls) ? body.mediaUrls.filter(Boolean) : [];
  const bodyMediaType: string | undefined = body.mediaType;
  const platformsList: string[] = Array.isArray(body.platforms) && body.platforms.length ? body.platforms : ["feed"];
  const scheduledAt: string | undefined = body.scheduledAt;
  const bodyStatus: string | undefined = body.status;

  // Pre-stream validation returns a normal JSON error (nothing has streamed yet).
  if (!caption.trim() && mediaUrls.length === 0) {
    return NextResponse.json({ success: false, error: { message: "Write a caption or add media first." } }, { status: 400 });
  }

  // Status: explicit DRAFT saves without publishing; a future scheduledAt → SCHEDULED; else PUBLISHED now.
  let status = "PUBLISHED";
  let parsedScheduledAt: Date | null = null;
  if (typeof bodyStatus === "string" && bodyStatus.toUpperCase() === "DRAFT") {
    status = "DRAFT";
  } else if (scheduledAt) {
    const d = new Date(scheduledAt);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ success: false, error: { message: "Invalid schedule time." } }, { status: 400 });
    }
    if (d > new Date()) { status = "SCHEDULED"; parsedScheduledAt = d; }
  }

  const hashtags = caption.match(/#[\w]+/g) || [];
  const mentions = caption.match(/@[\w]+/g) || [];
  const allMediaKeys = mediaUrls.map((u) => extractS3Key(u)).filter(Boolean);
  const primaryMediaUrl = allMediaKeys[0] || null;
  const mediaType = mediaUrls.length > 0 ? (bodyMediaType === "video" ? "video" : "image") : null;
  const platformsJson = JSON.stringify(platformsList);
  const hasExternal = platformsList.some((p) => p !== "feed");

  const encoder = new TextEncoder();
  const userId = session.userId;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (ev: Record<string, unknown>) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`)); } catch { /* client gone */ }
      };
      const close = () => { if (!closed) { closed = true; try { controller.close(); } catch { /* noop */ } } };

      try {
        const post = await prisma.post.create({
          data: {
            userId,
            caption,
            mediaUrl: primaryMediaUrl,
            mediaType,
            mediaMeta: allMediaKeys.length > 0 ? JSON.stringify(allMediaKeys) : null,
            hashtags: JSON.stringify(hashtags),
            mentions: JSON.stringify(mentions),
            platforms: platformsJson,
            status,
            scheduledAt: parsedScheduledAt,
            publishedAt: status === "PUBLISHED" ? new Date() : null,
          },
          select: { id: true, status: true, scheduledAt: true },
        });

        send({ type: "created", postId: post.id, status: post.status, scheduledAt: post.scheduledAt?.toISOString() || null });

        let publishResults: Record<string, unknown> = {};
        if (status === "PUBLISHED" && hasExternal) {
          publishResults = await publishToSocialPlatforms(
            post.id,
            userId,
            undefined,
            (ev: PublishProgress) => send({ ...ev }),
          );
        }

        send({ type: "done", postId: post.id, status: post.status, publishResults });
      } catch (err: any) {
        console.error("[Content Posts Stream] error:", err);
        send({ type: "error", message: err?.message || "Couldn't publish that post." });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
