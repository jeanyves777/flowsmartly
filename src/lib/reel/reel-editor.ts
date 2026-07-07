import { prisma } from "@/lib/db/client";
import type { ReelCampaign, ReelClip, ReelPost } from "@prisma/client";
import {
  buildReelClips,
  coerceSettings,
  parseJson,
  type ReelAspect,
  type ReelChannelId,
  type ReelClipContent,
  type ReelSettings,
  type ReelSourceType,
  type CaptionWord,
  type RenderStatus,
  type Transcript,
} from "./highlights";

/**
 * reel-editor.ts — the ONE shared DB engine for the Reel Studio. Both the
 * editor API routes AND the flow-agent tools (build_reels / get_reel_content /
 * edit_clip / publish_reels) call these functions, so there is a single
 * implementation of persist / read / update / publish. Auth + credit gating
 * stay with each caller. The pure scoring pipeline lives in ./highlights.
 *
 * A ReelCampaign is one build (source video + settings) with many scored
 * ReelClips; each clip has many ReelPosts (a publish/schedule record per
 * channel). The actual video cut + reframe + caption RENDER is a downstream
 * ffmpeg worker that fills clip.renderUrl; until then renderStatus is "pending".
 */

export type ReelStatus = "DRAFT" | "PROCESSING" | "READY" | "FAILED";

export interface ReelCampaignContent {
  id: string;
  title: string;
  sourceType: ReelSourceType;
  sourceUrl: string | null;
  sourceFileUrl: string | null;
  durationSec: number;
  settings: ReelSettings;
  status: ReelStatus;
  error: string | null;
  clips: ReelClipContent[];
  createdAt: string;
  updatedAt: string;
}

export interface ReelPostContent {
  id: string;
  clipId: string;
  channel: ReelChannelId;
  status: "draft" | "scheduled" | "posting" | "posted" | "failed";
  scheduledAt: string | null;
  postedAt: string | null;
  externalUrl: string | null;
}

// ── Serialize DB rows → content ───────────────────────────────────────────────
export function serializeReelClip(row: ReelClip): ReelClipContent {
  return {
    id: row.id,
    order: row.order,
    startSec: row.startSec,
    endSec: row.endSec,
    durationSec: Math.round((row.endSec - row.startSec) * 100) / 100,
    title: row.title,
    hook: row.hook,
    score: row.score,
    aspect: (row.aspect as ReelAspect) || "9:16",
    caption: parseJson<CaptionWord[]>(row.caption, []),
    transcriptText: row.transcriptText,
    hashtags: parseJson<string[]>(row.hashtags, []),
    renderStatus: (row.renderStatus as RenderStatus) || "pending",
    renderUrl: row.renderUrl,
    thumbUrl: row.thumbUrl,
  };
}

export function serializeReelCampaign(row: ReelCampaign & { clips?: ReelClip[] }): ReelCampaignContent {
  const clips = (row.clips || []).slice().sort((a, b) => b.score - a.score).map(serializeReelClip);
  return {
    id: row.id,
    title: row.title,
    sourceType: (row.sourceType as ReelSourceType) || "link",
    sourceUrl: row.sourceUrl,
    sourceFileUrl: row.sourceFileUrl,
    durationSec: row.durationSec,
    settings: coerceSettings(parseJson<Record<string, unknown>>(row.settings, {})),
    status: (row.status as ReelStatus) || "DRAFT",
    error: row.error,
    clips,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeReelPost(row: ReelPost): ReelPostContent {
  return {
    id: row.id,
    clipId: row.clipId,
    channel: row.channel as ReelChannelId,
    status: (row.status as ReelPostContent["status"]) || "draft",
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    externalUrl: row.externalUrl,
  };
}

// ── Create (run pipeline + persist) ───────────────────────────────────────────
export interface BuildReelsInput {
  userId: string;
  brandKitId?: string | null;
  title: string;
  sourceType?: ReelSourceType;
  sourceUrl?: string | null;
  sourceFileUrl?: string | null;
  durationSec?: number;
  transcript: Transcript;
  settings?: Partial<ReelSettings>;
}

/**
 * Run the highlight pipeline and persist a READY campaign with its scored
 * clips (renderStatus "pending" — the ffmpeg worker fills renderUrl after).
 */
export async function buildReelsFromTranscript(input: BuildReelsInput): Promise<ReelCampaignContent> {
  const settings = coerceSettings(input.settings || {});
  const clips = buildReelClips(input.transcript, settings);

  const row = await prisma.reelCampaign.create({
    data: {
      userId: input.userId,
      brandKitId: input.brandKitId || null,
      title: input.title.trim() || "Untitled reels",
      sourceType: input.sourceType || "link",
      sourceUrl: input.sourceUrl ?? null,
      sourceFileUrl: input.sourceFileUrl ?? null,
      durationSec: Math.round(input.durationSec || 0),
      transcript: JSON.stringify(input.transcript),
      settings: JSON.stringify(settings),
      status: clips.length > 0 ? "READY" : "FAILED",
      error: clips.length > 0 ? null : "No strong moments found in this video.",
      clips: {
        create: clips.map((c) => ({
          startSec: c.startSec,
          endSec: c.endSec,
          order: c.order,
          title: c.title,
          hook: c.hook,
          score: c.score,
          aspect: c.aspect,
          caption: JSON.stringify(c.caption),
          transcriptText: c.transcriptText,
          hashtags: JSON.stringify(c.hashtags),
          renderStatus: "pending",
        })),
      },
    },
    include: { clips: true },
  });
  return serializeReelCampaign(row);
}

// ── Reads ─────────────────────────────────────────────────────────────────────
export async function readReelCampaigns(userId: string): Promise<ReelCampaignContent[]> {
  const rows = await prisma.reelCampaign.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { clips: true },
  });
  return rows.map(serializeReelCampaign);
}

export async function readReelCampaignById(id: string, userId: string): Promise<ReelCampaignContent | null> {
  const row = await prisma.reelCampaign.findFirst({
    where: { id, userId, deletedAt: null },
    include: { clips: true },
  });
  return row ? serializeReelCampaign(row) : null;
}

/** The user's most recent campaign (the one the Studio opens by default). */
export async function readLatestReelCampaign(userId: string): Promise<ReelCampaignContent | null> {
  const row = await prisma.reelCampaign.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { clips: true },
  });
  return row ? serializeReelCampaign(row) : null;
}

// ── Update a clip ─────────────────────────────────────────────────────────────
export interface ClipPatch {
  title?: string;
  hook?: string | null;
  aspect?: ReelAspect;
  caption?: CaptionWord[];
  hashtags?: string[];
  order?: number;
  startSec?: number;
  endSec?: number;
  renderStatus?: RenderStatus;
  renderUrl?: string | null;
  thumbUrl?: string | null;
}

export async function applyClipUpdate(args: { clipId: string; userId: string; patch: ClipPatch }): Promise<ReelClipContent> {
  const current = await prisma.reelClip.findFirst({
    where: { id: args.clipId, campaign: { userId: args.userId, deletedAt: null } },
  });
  if (!current) throw new Error("Clip not found");

  const { patch } = args;
  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.hook !== undefined) data.hook = patch.hook;
  if (patch.aspect !== undefined) data.aspect = patch.aspect;
  if (patch.caption !== undefined) data.caption = JSON.stringify(patch.caption);
  if (patch.hashtags !== undefined) data.hashtags = JSON.stringify(patch.hashtags);
  if (patch.order !== undefined) data.order = patch.order;
  if (patch.startSec !== undefined) data.startSec = patch.startSec;
  if (patch.endSec !== undefined) data.endSec = patch.endSec;
  if (patch.renderStatus !== undefined) data.renderStatus = patch.renderStatus;
  if (patch.renderUrl !== undefined) data.renderUrl = patch.renderUrl;
  if (patch.thumbUrl !== undefined) data.thumbUrl = patch.thumbUrl;

  const row = await prisma.reelClip.update({ where: { id: current.id }, data });
  return serializeReelClip(row);
}

export async function deleteReelCampaign(id: string, userId: string): Promise<void> {
  await prisma.reelCampaign.updateMany({ where: { id, userId }, data: { deletedAt: new Date() } });
}

// ── Publish records ───────────────────────────────────────────────────────────
export interface CreateReelPostInput {
  userId: string;
  clipId: string;
  channel: ReelChannelId;
  scheduledAt?: Date | null;
}

/** Queue a clip for a channel — "scheduled" if a time is given, else "posting". */
export async function createReelPost(input: CreateReelPostInput): Promise<ReelPostContent> {
  const clip = await prisma.reelClip.findFirst({
    where: { id: input.clipId, campaign: { userId: input.userId, deletedAt: null } },
    select: { id: true },
  });
  if (!clip) throw new Error("Clip not found");

  const row = await prisma.reelPost.create({
    data: {
      clipId: input.clipId,
      userId: input.userId,
      channel: input.channel,
      status: input.scheduledAt ? "scheduled" : "posting",
      scheduledAt: input.scheduledAt ?? null,
    },
  });
  return serializeReelPost(row);
}

export async function listPostsForCampaign(campaignId: string, userId: string): Promise<ReelPostContent[]> {
  const rows = await prisma.reelPost.findMany({
    where: { userId, clip: { campaignId } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializeReelPost);
}
