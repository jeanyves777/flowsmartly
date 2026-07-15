/**
 * Publish a finished product-ad take to connected channels — same shared social
 * publisher as the Director film / UGC take. No new DB model.
 */
import { prisma } from "@/lib/db/client";
import { publishToSocialPlatforms } from "@/lib/social/publisher";
import { extractS3Key } from "@/lib/utils/s3-client";
import { parseJson } from "@/lib/reel/highlights";
import { getAdProject } from "./store";

export type AdChannelId = "tiktok" | "instagram" | "youtube" | "facebook" | "linkedin" | "x";
export const AD_CHANNELS: { id: AdChannelId; name: string }[] = [
  { id: "tiktok", name: "TikTok" }, { id: "instagram", name: "Instagram" }, { id: "youtube", name: "YouTube" },
  { id: "facebook", name: "Facebook" }, { id: "linkedin", name: "LinkedIn" }, { id: "x", name: "X" },
];
const CHANNEL_TO_PLATFORM: Record<AdChannelId, string> = {
  tiktok: "tiktok", instagram: "instagram", youtube: "youtube", facebook: "facebook", linkedin: "linkedin", x: "twitter",
};
export function isAdChannel(id: string): id is AdChannelId {
  return AD_CHANNELS.some((c) => c.id === id);
}

export interface AdPublishOutcome { channel: AdChannelId; status: string; externalUrl: string | null }

export async function publishAdTake(args: {
  userId: string; projectId: string; takeId: string;
  channels: AdChannelId[]; caption?: string; scheduledAt: Date | null;
}): Promise<{ ok: boolean; message?: string; outcomes: AdPublishOutcome[] }> {
  const project = await getAdProject(args.projectId, args.userId);
  if (!project) return { ok: false, message: "Project not found.", outcomes: [] };
  const take = project.takes.find((t) => t.id === args.takeId);
  if (!take?.videoUrl) return { ok: false, message: "That take isn't ready to publish yet.", outcomes: [] };

  const caption = (args.caption || project.title || "").trim().slice(0, 2200);
  const key = extractS3Key(take.videoUrl);
  const platforms = args.channels.map((c) => CHANNEL_TO_PLATFORM[c]);

  const post = await prisma.post.create({
    data: {
      userId: args.userId, caption, mediaType: "video", mediaUrl: take.videoUrl,
      mediaMeta: JSON.stringify([key]), platforms: JSON.stringify(platforms),
      status: args.scheduledAt ? "SCHEDULED" : "PUBLISHED", scheduledAt: args.scheduledAt,
    },
  });

  let pr: Record<string, { success?: boolean; postId?: string; url?: string }> = {};
  if (!args.scheduledAt) {
    try {
      await publishToSocialPlatforms(post.id, args.userId);
      const fresh = await prisma.post.findUnique({ where: { id: post.id }, select: { publishResults: true } });
      pr = parseJson<typeof pr>(fresh?.publishResults, {});
    } catch (e) {
      console.error("[product-ads publish]", e instanceof Error ? e.message : e);
    }
  }
  const outcomes: AdPublishOutcome[] = args.channels.map((channel) => {
    const r = pr[CHANNEL_TO_PLATFORM[channel]];
    const status = args.scheduledAt ? "scheduled" : r?.success ? "posted" : Object.keys(pr).length ? "failed" : "posting";
    return { channel, status, externalUrl: r?.url || null };
  });
  return { ok: true, outcomes };
}
