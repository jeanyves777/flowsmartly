import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getCampaign } from "@/lib/story-ad-campaign";
import { publishToSocialPlatforms } from "@/lib/social/publisher";
import { extractS3Key, presignAllUrls } from "@/lib/utils/s3-client";

/**
 * Publish the campaign's final reel to FlowSmartly feed + selected social destinations.
 *
 * NOTE: This route used to forward to `/api/content/posts` via a server-to-self HTTPS fetch.
 * That broke in production because Next is bound to localhost:3000 (plain HTTP) and nginx
 * terminates TLS in front — the loopback ended up talking HTTPS to a plain HTTP socket
 * ("ssl3_get_record: wrong version number"). The fix is to call prisma + the publisher
 * directly, no HTTP loop.
 */
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

  // Compose final caption with hashtags appended (matches /content/posts behavior)
  const finalCaption = [caption, hashtags.join(" ")].filter((s) => s && s.length).join("\n\n");
  if (!finalCaption.trim()) {
    return NextResponse.json(
      { success: false, error: { message: "Caption is required." } },
      { status: 400 },
    );
  }

  // Parse hashtags/mentions out of caption — same shape /content/posts saves.
  const parsedHashtags = finalCaption.match(/#[\w]+/g) || [];
  const parsedMentions = finalCaption.match(/@[\w]+/g) || [];

  // Resolve schedule
  let status: "PUBLISHED" | "SCHEDULED" = "PUBLISHED";
  let scheduledAt: Date | null = null;
  if (body.scheduledAt) {
    const parsed = new Date(body.scheduledAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid scheduledAt date format." } },
        { status: 400 },
      );
    }
    if (parsed > new Date()) {
      status = "SCHEDULED";
      scheduledAt = parsed;
    }
  }

  // Convert presigned video URL into a stable S3 key so the column doesn't expire.
  const videoKey = extractS3Key(current.state.finalVideoUrl);
  if (!videoKey) {
    return NextResponse.json(
      { success: false, error: { message: "Could not resolve reel media key." } },
      { status: 500 },
    );
  }
  const mediaMetaJson = JSON.stringify([videoKey]);
  const platformsJson = JSON.stringify(platforms);

  try {
    const post = await prisma.post.create({
      data: {
        userId: session.userId,
        caption: finalCaption,
        mediaUrl: videoKey,
        mediaType: "video",
        mediaMeta: mediaMetaJson,
        hashtags: JSON.stringify(parsedHashtags),
        mentions: JSON.stringify(parsedMentions),
        platforms: platformsJson,
        status,
        scheduledAt,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Fire external publishers when this is an immediate publish to non-feed destinations.
    let publishResults: Record<string, { success: boolean; postId?: string; error?: string }> = {};
    const hasExternalPlatforms = platforms.some((p) => p !== "feed");
    if (status === "PUBLISHED" && hasExternalPlatforms) {
      try {
        publishResults = await publishToSocialPlatforms(post.id, session.userId);
      } catch (err) {
        console.error("[StoryAdCampaign.publish] publisher threw:", err);
        // Per-platform failures end up here as a hard throw; mark every external destination
        // as failed so the UI can show useful feedback instead of an opaque "Publish failed".
        for (const p of platforms.filter((x) => x !== "feed")) {
          publishResults[p] = {
            success: false,
            error: err instanceof Error ? err.message : "Publisher crashed",
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        post: {
          id: post.id,
          caption: post.caption,
          mediaUrls: [videoKey],
          mediaType: post.mediaType,
          hashtags: parsedHashtags,
          mentions: parsedMentions,
          platforms,
          status: post.status,
          scheduledAt: post.scheduledAt?.toISOString() || null,
          publishedAt: post.publishedAt?.toISOString() || null,
          author: {
            id: post.user.id,
            name: post.user.name,
            username: post.user.username,
            avatarUrl: post.user.avatarUrl,
          },
          createdAt: post.createdAt.toISOString(),
        },
        publishResults,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    console.error("[StoryAdCampaign.publish] create+publish threw:", error);
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 },
    );
  }
}
