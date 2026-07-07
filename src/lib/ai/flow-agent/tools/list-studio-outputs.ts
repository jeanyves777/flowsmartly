import { prisma } from "@/lib/db/client";
import { listAvatarVideos } from "@/lib/avatar-studio";
import type { FlowAgentTool } from "../registry";

/**
 * Read-only listers for the media STUDIO outputs the user accumulates — avatar
 * videos, ad campaigns, voiceovers — so the agent can reference/reuse an existing
 * one instead of asking or regenerating. [[avatar-studio-heygen]] [[voice-studio]]
 */

export const listAvatarVideosTool: FlowAgentTool = {
  name: "list_avatar_videos",
  description:
    "READ the avatar/talking-head videos the user has generated (Avatar Studio). Returns each video's id, title, status, progress, and video/thumbnail url. Read-only.",
  input_schema: { type: "object", properties: { limit: { type: "number", description: "Max videos (1-50, default 24)." } } },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(50, Math.max(1, Math.floor(input.limit))) : 24;
      const rows = await listAvatarVideos(ctx.userId, limit);
      return {
        ok: true,
        data: {
          count: rows.length,
          videos: rows.map((v) => ({
            id: v.id, title: v.title, status: v.status, progress: v.progress,
            videoUrl: v.videoUrl ?? null, thumbnailUrl: v.thumbnailUrl ?? null,
            lengthSeconds: v.lengthSeconds ?? null,
            createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt,
          })),
          userMessage: rows.length === 0 ? "No avatar videos yet." : `${rows.length} avatar video${rows.length === 1 ? "" : "s"}.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list avatar videos" };
    }
  },
};

export const listAdCampaigns: FlowAgentTool = {
  name: "list_ad_campaigns",
  description:
    "READ the user's paid AD campaigns (Ad Builder). Optional status filter (DRAFT | ACTIVE | PAUSED | COMPLETED). Returns each ad's id, name, objective, status, budget, spend, and performance (impressions/clicks/conversions). Read-only. (Distinct from content campaigns — list_content_campaigns — and email/SMS — list_campaigns.)",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Optional status filter." },
      limit: { type: "number", description: "Max ads (1-50, default 20)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(50, Math.max(1, Math.floor(input.limit))) : 20;
      const where: Record<string, unknown> = { userId: ctx.userId };
      if (typeof input.status === "string" && input.status.trim()) where.status = input.status.trim().toUpperCase();
      const rows = await prisma.adCampaign.findMany({
        where, orderBy: { createdAt: "desc" }, take: limit,
        select: { id: true, name: true, objective: true, status: true, budgetCents: true, spentCents: true, impressions: true, clicks: true, conversions: true, startDate: true, endDate: true },
      });
      const money = (c: number) => `USD ${(c / 100).toFixed(2)}`;
      return {
        ok: true,
        data: {
          count: rows.length,
          ads: rows.map((a) => ({
            id: a.id, name: a.name, objective: a.objective, status: a.status,
            budget: money(a.budgetCents), spent: money(a.spentCents),
            impressions: a.impressions, clicks: a.clicks, conversions: a.conversions,
            startDate: a.startDate.toISOString(), endDate: a.endDate?.toISOString() ?? null,
          })),
          userMessage: rows.length === 0 ? "No ad campaigns yet." : `${rows.length} ad campaign${rows.length === 1 ? "" : "s"}.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list ad campaigns" };
    }
  },
};

export const listVoiceovers: FlowAgentTool = {
  name: "list_voiceovers",
  description:
    "READ the voiceovers/narrations the user has generated (Voice Studio) — their OWN generations, not the available platform voices (that's list_voices). Returns each one's id, script preview, voice style, duration, status and audio url. Read-only.",
  input_schema: { type: "object", properties: { limit: { type: "number", description: "Max voiceovers (1-50, default 20)." } } },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(50, Math.max(1, Math.floor(input.limit))) : 20;
      const rows = await prisma.voiceGeneration.findMany({
        where: { userId: ctx.userId }, orderBy: { createdAt: "desc" }, take: limit,
        select: { id: true, script: true, gender: true, accent: true, style: true, isClonedVoice: true, audioUrl: true, durationMs: true, status: true, createdAt: true },
      });
      return {
        ok: true,
        data: {
          count: rows.length,
          voiceovers: rows.map((v) => ({
            id: v.id,
            script: (v.script || "").slice(0, 120),
            voice: [v.gender, v.accent, v.style].filter(Boolean).join(" · ") || (v.isClonedVoice ? "cloned voice" : "default"),
            durationSec: v.durationMs ? Math.round(v.durationMs / 1000) : null,
            status: v.status, audioUrl: v.audioUrl ?? null, createdAt: v.createdAt.toISOString(),
          })),
          userMessage: rows.length === 0 ? "No voiceovers yet." : `${rows.length} voiceover${rows.length === 1 ? "" : "s"}.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list voiceovers" };
    }
  },
};
