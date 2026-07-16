/**
 * Voice Studio — publish a finished narrated film to connected channels.
 * Mirrors the Director's publish path: a real Post + a real publish, and honest
 * per-channel outcomes (never "all live"). [[voice-studio]]
 */
import { prisma } from "@/lib/db/client";
import { getNarration } from "./store";
import { publishToSocialPlatforms } from "@/lib/social/publisher";
import { extractS3Key } from "@/lib/utils/s3-client";

export type NarrationChannelId = "tiktok" | "instagram" | "youtube" | "facebook" | "linkedin" | "x";

const CHANNEL_TO_PLATFORM: Record<NarrationChannelId, string> = {
  tiktok: "TIKTOK", instagram: "INSTAGRAM", youtube: "YOUTUBE",
  facebook: "FACEBOOK", linkedin: "LINKEDIN", x: "TWITTER",
};

export interface NarrationPublishOutcome {
  channel: string;
  status: string;
  externalUrl: string | null;
}

export async function publishNarration(args: {
  userId: string;
  narrationId: string;
  channels: NarrationChannelId[];
  caption?: string;
  scheduledAt: Date | null;
}): Promise<{ ok: boolean; message?: string; outcomes: NarrationPublishOutcome[] }> {
  const p = await getNarration(args.narrationId, args.userId);
  if (!p) return { ok: false, message: "Narration not found.", outcomes: [] };
  if (!p.finalVideoUrl) {
    return { ok: false, message: "Stitch the film first — there's nothing to publish yet.", outcomes: [] };
  }
  if (args.channels.length === 0) return { ok: false, message: "Pick at least one channel.", outcomes: [] };

  const caption = (args.caption || p.title || "").trim().slice(0, 2200);
  const key = extractS3Key(p.finalVideoUrl);
  const platforms = args.channels.map((c) => CHANNEL_TO_PLATFORM[c]);

  const post = await prisma.post.create({
    data: {
      userId: args.userId,
      caption,
      mediaType: "video",
      mediaUrl: p.finalVideoUrl,
      mediaMeta: JSON.stringify([key]),
      platforms: JSON.stringify(platforms),
      status: args.scheduledAt ? "SCHEDULED" : "PUBLISHED",
      scheduledAt: args.scheduledAt,
      publishedAt: args.scheduledAt ? null : new Date(),
    },
    select: { id: true },
  });

  // Fan out for real (immediate); a scheduled post is left to the scheduled publisher.
  let pr: Record<string, { success?: boolean; postId?: string; url?: string }> = {};
  if (!args.scheduledAt) {
    try {
      await publishToSocialPlatforms(post.id, args.userId);
      const fresh = await prisma.post.findUnique({ where: { id: post.id }, select: { publishResults: true } });
      try { pr = fresh?.publishResults ? (JSON.parse(fresh.publishResults) as typeof pr) : {}; } catch { pr = {}; }
    } catch (e) {
      console.error("[voice-studio publish]", e instanceof Error ? e.message : e);
    }
  }

  // Report what each channel ACTUALLY did — never a blanket "all live".
  const outcomes: NarrationPublishOutcome[] = args.channels.map((channel) => {
    const r = pr[CHANNEL_TO_PLATFORM[channel]];
    const status = args.scheduledAt ? "scheduled" : r?.success ? "posted" : Object.keys(pr).length ? "failed" : "posting";
    return { channel, status, externalUrl: r?.url || null };
  });
  return { ok: true, outcomes };
}
