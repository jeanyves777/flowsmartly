/**
 * Publish one finished UGC take to the user's connected channels — reuses the shared
 * social publisher (a take's video becomes a Post fanned out immediately, or SCHEDULED).
 * Mirrors the Video Director film publisher; no new DB model.
 */
import { prisma } from "@/lib/db/client";
import { publishToSocialPlatforms } from "@/lib/social/publisher";
import { extractS3Key } from "@/lib/utils/s3-client";
import { parseJson } from "@/lib/reel/highlights";
import { getUgcProject } from "./store";

export type UgcChannelId = "tiktok" | "instagram" | "youtube" | "facebook" | "linkedin" | "x";
export const UGC_CHANNELS: { id: UgcChannelId; name: string }[] = [
  { id: "tiktok", name: "TikTok" }, { id: "instagram", name: "Instagram" }, { id: "youtube", name: "YouTube" },
  { id: "facebook", name: "Facebook" }, { id: "linkedin", name: "LinkedIn" }, { id: "x", name: "X" },
];
const CHANNEL_TO_PLATFORM: Record<UgcChannelId, string> = {
  tiktok: "tiktok", instagram: "instagram", youtube: "youtube", facebook: "facebook", linkedin: "linkedin", x: "twitter",
};
export function isUgcChannel(id: string): id is UgcChannelId {
  return UGC_CHANNELS.some((c) => c.id === id);
}

export interface UgcPublishOutcome { channel: UgcChannelId; status: string; externalUrl: string | null }

export async function publishTake(args: {
  userId: string; projectId: string; takeId: string;
  channels: UgcChannelId[]; caption?: string; scheduledAt: Date | null;
}): Promise<{ ok: boolean; message?: string; outcomes: UgcPublishOutcome[] }> {
  const project = await getUgcProject(args.projectId, args.userId);
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
      console.error("[ugc-studio publish]", e instanceof Error ? e.message : e);
    }
  }
  const outcomes: UgcPublishOutcome[] = args.channels.map((channel) => {
    const r = pr[CHANNEL_TO_PLATFORM[channel]];
    const status = args.scheduledAt ? "scheduled" : r?.success ? "posted" : Object.keys(pr).length ? "failed" : "posting";
    return { channel, status, externalUrl: r?.url || null };
  });
  return { ok: true, outcomes };
}
