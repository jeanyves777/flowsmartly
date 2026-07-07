import { prisma } from "@/lib/db/client";
import { publishToSocialPlatforms } from "@/lib/social/publisher";
import { extractS3Key } from "@/lib/utils/s3-client";
import { parseJson, type ReelChannelId } from "./highlights";

/**
 * reel-publish.ts — route a reel clip to REAL social posting through the app's
 * existing publisher. A rendered clip becomes a `Post` (video) and is fanned out
 * via `publishToSocialPlatforms` (immediate) or left `SCHEDULED` for the
 * scheduled-post cron. A per-channel `ReelPost` records the outcome so the
 * studio's Activity tab reflects live status + the external URL.
 *
 * If the clip isn't rendered yet (renderStatus !== "ready"), we record intent
 * (posting/scheduled) without fanning out — the render worker + a later publish
 * pass complete it. Degrades safely; never throws to the caller.
 */

const CHANNEL_TO_PLATFORM: Record<ReelChannelId, string> = {
  tiktok: "tiktok", instagram: "instagram", youtube: "youtube",
  facebook: "facebook", linkedin: "linkedin", x: "twitter",
};

export interface PublishReelOutcome {
  clipId: string;
  channel: ReelChannelId;
  status: string;
  externalUrl: string | null;
}

export async function publishReelClips(args: {
  userId: string;
  clipIds: string[];
  channels: ReelChannelId[];
  scheduledAt: Date | null;
}): Promise<PublishReelOutcome[]> {
  const out: PublishReelOutcome[] = [];

  for (const clipId of args.clipIds) {
    const clip = await prisma.reelClip.findFirst({
      where: { id: clipId, campaign: { userId: args.userId, deletedAt: null } },
      select: { id: true, title: true, hashtags: true, renderUrl: true, renderStatus: true },
    });
    if (!clip) continue;

    const tags = parseJson<string[]>(clip.hashtags, []);
    const caption = [clip.title, tags.join(" ")].filter(Boolean).join("\n\n");
    const platforms = args.channels.map((c) => CHANNEL_TO_PLATFORM[c]);

    // Not rendered yet → record intent; render worker + scheduled publisher finish it.
    if (!clip.renderUrl || clip.renderStatus !== "ready") {
      for (const channel of args.channels) {
        const rp = await prisma.reelPost.create({
          data: { clipId, userId: args.userId, channel, status: args.scheduledAt ? "scheduled" : "posting", scheduledAt: args.scheduledAt },
        });
        out.push({ clipId, channel, status: rp.status, externalUrl: null });
      }
      continue;
    }

    // Rendered → create a Post and fan out for real.
    const key = extractS3Key(clip.renderUrl);
    const post = await prisma.post.create({
      data: {
        userId: args.userId,
        caption,
        mediaType: "video",
        mediaUrl: clip.renderUrl,
        mediaMeta: JSON.stringify([key]),
        platforms: JSON.stringify(platforms),
        status: args.scheduledAt ? "SCHEDULED" : "PUBLISHED",
        scheduledAt: args.scheduledAt,
      },
    });

    let pr: Record<string, { success?: boolean; postId?: string; url?: string }> = {};
    if (!args.scheduledAt) {
      try {
        await publishToSocialPlatforms(post.id, args.userId);
        const fresh = await prisma.post.findUnique({ where: { id: post.id }, select: { publishResults: true } });
        pr = parseJson<typeof pr>(fresh?.publishResults, {});
      } catch (e) {
        console.error("[reel-publish]", e instanceof Error ? e.message : e);
      }
    }

    for (const channel of args.channels) {
      const r = pr[CHANNEL_TO_PLATFORM[channel]];
      const status = args.scheduledAt ? "scheduled" : r?.success ? "posted" : Object.keys(pr).length ? "failed" : "posting";
      const rp = await prisma.reelPost.create({
        data: {
          clipId, userId: args.userId, channel, status,
          scheduledAt: args.scheduledAt,
          postedAt: status === "posted" ? new Date() : null,
          externalUrl: r?.url || null,
          externalId: r?.postId || null,
        },
      });
      out.push({ clipId, channel, status: rp.status, externalUrl: rp.externalUrl });
    }
  }
  return out;
}
