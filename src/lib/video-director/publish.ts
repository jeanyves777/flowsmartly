/**
 * Publish a finished Director film to the user's connected social channels — the
 * canvas's final "Publish" node. Mirrors the Reel publisher: the stitched final
 * video becomes a Post and is fanned out via the shared social publisher (immediate)
 * or left SCHEDULED. No new DB model — one Post per publish, results read back per platform.
 */
import { prisma } from "@/lib/db/client";
import { publishToSocialPlatforms } from "@/lib/social/publisher";
import { extractS3Key } from "@/lib/utils/s3-client";
import { parseJson } from "@/lib/reel/highlights";
import { getFilm } from "./store";

export type FilmChannelId = "tiktok" | "instagram" | "youtube" | "facebook" | "linkedin" | "x";

export const FILM_CHANNELS: { id: FilmChannelId; name: string }[] = [
  { id: "tiktok", name: "TikTok" },
  { id: "instagram", name: "Instagram" },
  { id: "youtube", name: "YouTube" },
  { id: "facebook", name: "Facebook" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "x", name: "X" },
];

const CHANNEL_TO_PLATFORM: Record<FilmChannelId, string> = {
  tiktok: "tiktok", instagram: "instagram", youtube: "youtube",
  facebook: "facebook", linkedin: "linkedin", x: "twitter",
};

export function isFilmChannel(id: string): id is FilmChannelId {
  return FILM_CHANNELS.some((c) => c.id === id);
}

export interface FilmPublishOutcome { channel: FilmChannelId; status: string; externalUrl: string | null }

export async function publishFilm(args: {
  userId: string;
  filmId: string;
  channels: FilmChannelId[];
  caption?: string;
  scheduledAt: Date | null;
}): Promise<{ ok: boolean; message?: string; outcomes: FilmPublishOutcome[] }> {
  const film = await getFilm(args.filmId, args.userId);
  if (!film) return { ok: false, message: "Film not found.", outcomes: [] };
  if (!film.finalVideoUrl) {
    return { ok: false, message: "Stitch the film into a final video first — there's nothing to publish yet.", outcomes: [] };
  }

  const caption = (args.caption || film.title || "").trim().slice(0, 2200);
  const key = extractS3Key(film.finalVideoUrl);
  const platforms = args.channels.map((c) => CHANNEL_TO_PLATFORM[c]);

  const post = await prisma.post.create({
    data: {
      userId: args.userId,
      caption,
      mediaType: "video",
      mediaUrl: film.finalVideoUrl,
      mediaMeta: JSON.stringify([key]),
      platforms: JSON.stringify(platforms),
      status: args.scheduledAt ? "SCHEDULED" : "PUBLISHED",
      scheduledAt: args.scheduledAt,
    },
  });

  // Fan out for real (immediate) — a scheduled post is left for the scheduled publisher.
  let pr: Record<string, { success?: boolean; postId?: string; url?: string }> = {};
  if (!args.scheduledAt) {
    try {
      await publishToSocialPlatforms(post.id, args.userId);
      const fresh = await prisma.post.findUnique({ where: { id: post.id }, select: { publishResults: true } });
      pr = parseJson<typeof pr>(fresh?.publishResults, {});
    } catch (e) {
      console.error("[video-director publish]", e instanceof Error ? e.message : e);
    }
  }

  const outcomes: FilmPublishOutcome[] = args.channels.map((channel) => {
    const r = pr[CHANNEL_TO_PLATFORM[channel]];
    const status = args.scheduledAt ? "scheduled" : r?.success ? "posted" : Object.keys(pr).length ? "failed" : "posting";
    return { channel, status, externalUrl: r?.url || null };
  });
  return { ok: true, outcomes };
}
