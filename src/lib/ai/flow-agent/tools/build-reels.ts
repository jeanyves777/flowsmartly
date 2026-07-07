import { buildReelsFromTranscript } from "@/lib/reel/reel-editor";
import type { Transcript } from "@/lib/reel/highlights";
import type { FlowAgentTool } from "../registry";

/**
 * build_reels — turn a long video's TRANSCRIPT into a stack of scored, ready-to-
 * post 9:16 clips (a ReelCampaign on the Reel Studio canvas). Thin persist
 * wrapper like build_store/build_portfolio: YOU pass the transcript (obtained by
 * transcribing the source — whisper — or from provided captions); the tool runs
 * the deterministic highlight-scoring pipeline, persists the campaign + clips,
 * and streams them onto the canvas. The actual video cut + 9:16 reframe + burned
 * captions RENDER is a downstream ffmpeg worker (clips start renderStatus
 * "pending"). After building, tell the user the reels are on the Reel Studio
 * canvas (/home/reel), sorted by score, ready to edit or publish.
 */
export const buildReels: FlowAgentTool = {
  name: "build_reels",
  description:
    "Turn a long video into a stack of scored, ready-to-post 9:16 reels. Pass a `title` for the campaign, the source `transcript` (an object { segments: [{ start, end, text }] } — get it by transcribing the video's audio, or from provided captions/subtitles), optional source metadata (sourceUrl, durationSec) and optional `settings` (clipLength short/mid/long, aspect, count, captionStyle, speakerTracking). The tool scores the moments most likely to travel, cuts them into non-overlapping clips with titles + captions + hashtags, and drops them onto the Reel Studio canvas sorted by virality score. The 9:16 render happens after (clips show as 'pending' until rendered). One campaign per build — the user can make more. Tell them the reels are on the canvas at /home/reel, ready to edit or publish.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Campaign name, e.g. the video/episode title." },
      sourceType: { type: "string", enum: ["link", "upload"], description: "How the source came in." },
      sourceUrl: { type: "string", description: "Original video link (YouTube/Vimeo/Loom/…)." },
      durationSec: { type: "number", description: "Source length in seconds." },
      transcript: {
        type: "object",
        description: "The source transcript. { segments: [{ start, end, text }] } with times in seconds.",
        properties: {
          segments: {
            type: "array",
            items: {
              type: "object",
              properties: { start: { type: "number" }, end: { type: "number" }, text: { type: "string" } },
              required: ["start", "end", "text"],
            },
          },
        },
        required: ["segments"],
      },
      settings: {
        type: "object",
        description: "Clip settings.",
        properties: {
          clipLength: { type: "string", enum: ["auto", "short", "mid", "long"], description: "short=<30s, mid=30-60s, long=60-90s." },
          aspect: { type: "string", enum: ["9:16", "1:1", "16:9"] },
          count: { type: "number", description: "How many clips (1-12)." },
          captionStyle: { type: "string", enum: ["pop", "hype", "clean", "brand"] },
          speakerTracking: { type: "boolean" },
          animatedCaptions: { type: "boolean" },
          autoBroll: { type: "boolean" },
        },
      },
    },
    required: ["title", "transcript"],
  },
  plans: null,
  costKey: "AGENT_BUILD_REEL",
  mutating: true,
  autoPlanCost: async () => ({
    credits: 6,
    label: "Cut this video into scored reels",
    detail: "Finds the best moments, reframes to 9:16 and captions them — you can edit or publish after.",
  }),
  handler: async (input, ctx) => {
    try {
      const title = typeof input.title === "string" ? input.title.trim() : "";
      if (!title) return { ok: false, error_code: "missing_input", message: "A title is required to build the reels." };

      const t = input.transcript as { segments?: unknown } | undefined;
      const segments = Array.isArray(t?.segments) ? t!.segments : [];
      if (segments.length === 0) {
        return {
          ok: false,
          error_code: "missing_input",
          message:
            "A transcript is required. Transcribe the video's audio (whisper) or use the provided captions, then pass { segments: [{ start, end, text }] }.",
        };
      }
      const transcript: Transcript = {
        segments: (segments as Array<Record<string, unknown>>)
          .map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || "") }))
          .filter((s) => s.end > s.start && s.text.trim()),
      };

      const campaign = await buildReelsFromTranscript({
        userId: ctx.userId,
        brandKitId: null,
        title,
        sourceType: input.sourceType === "upload" ? "upload" : "link",
        sourceUrl: typeof input.sourceUrl === "string" ? input.sourceUrl : null,
        durationSec: typeof input.durationSec === "number" ? input.durationSec : 0,
        transcript,
        settings: (input.settings && typeof input.settings === "object" ? input.settings : {}) as Record<string, unknown>,
      });

      if (campaign.clips.length === 0) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: "No strong standalone moments were found in this video. It works best with spoken-word content (podcasts, talks, interviews).",
        };
      }

      // Stream the fresh campaign onto the Reel Studio canvas (live render).
      ctx.emit({ type: "canvas_update", patch: { __reel: { campaignId: campaign.id } } });

      const top = campaign.clips[0];
      return {
        ok: true,
        data: {
          campaignId: campaign.id,
          title: campaign.title,
          clipCount: campaign.clips.length,
          topScore: top.score,
          topTitle: top.title,
          clips: campaign.clips.map((c) => ({ id: c.id, title: c.title, score: c.score, durationSec: c.durationSec })),
          hint: "Reels are on the Reel Studio canvas (/home/reel), sorted by score. They're queued to render to 9:16. Use edit_clip to tweak one, or publish_reels to post/schedule.",
        },
        resultRefType: "ReelCampaign",
        resultRefId: campaign.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to build the reels." };
    }
  },
};
