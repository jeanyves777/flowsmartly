import { prisma } from "@/lib/db/client";
import { draftStoryAdScript, type StoryAdMovieScript } from "@/lib/story-ad-movie";
import {
  getUserPreferredLanguage,
  withLanguagePrefix,
  getLanguageLabel,
} from "@/lib/ai/user-language";
import type { FlowAgentTool } from "../registry";
import { scriptApprovalView } from "@/lib/agent-views/templates";

const DRAFT_TYPE = "story_ad_script_draft";

/**
 * draft_story_ad_script — the REVIEW-mode first step of a story-ad. It writes the
 * screenplay (brand-grounded, no render, no charge) and renders it inline in the
 * chat as an approval card so the user can APPROVE it (→ start_story_ad_campaign
 * with the returned draftId renders THAT exact script) or TWEAK it (call this
 * again with the change folded into the brief). Use this when the user wants to
 * review/approve the story before the paid render; skip straight to
 * start_story_ad_campaign for autopilot ("just make it").
 */
export const draftStoryAdScriptTool: FlowAgentTool = {
  name: "draft_story_ad_script",
  description:
    "REVIEW MODE for a story-ad: write the SCREENPLAY first (no render, no charge) and show it in the chat as an approval card. Use this when the user wants to see/approve the story before rendering (or asked to 'review each step'). Returns a draftId — when the user approves, call start_story_ad_campaign with that draftId (planId from a confirmed propose_plan) to render the approved script verbatim. If the user asks to tweak the script, call this again with the change folded into the brief (pass replaceDraftId to supersede the previous draft). For autopilot ('just make it / you decide'), skip this and call start_story_ad_campaign directly.",
  input_schema: {
    type: "object",
    properties: {
      brief: { type: "string", description: "Plain-English description of the ad — product, message, audience, mood. Min 12 chars. Fold any user tweak into this when re-drafting." },
      duration: { type: "number", description: "Total reel duration in seconds: 10, 20, 30, or 40." },
      aspectRatio: { type: "string", description: "'9:16' (default), '1:1', or '16:9'." },
      style: { type: "string", description: "'cinematic' (default), 'local_trust', 'premium', 'social_bold', or 'product_showcase'." },
      goal: { type: "string", description: "Optional — the conversion/outcome the ad should drive." },
      destinationUrl: { type: "string", description: "Optional — CTA link." },
      platforms: { type: "array", description: "Optional — target platforms ('instagram','tiktok',…).", items: { type: "string" } },
      characterBrief: { type: "string", description: "Optional — describe the protagonist." },
      replaceDraftId: { type: "string", description: "Optional — when re-drafting after a tweak, the previous draftId to supersede (it's removed)." },
    },
    required: ["brief", "duration"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  handler: async (input, ctx) => {
    const brief = typeof input.brief === "string" ? input.brief.trim() : "";
    if (brief.length < 12) {
      return { ok: false, error_code: "missing_input", message: "brief must be at least 12 characters — tell me what the ad should be about." };
    }
    const duration = [10, 20, 30, 40].includes(Number(input.duration)) ? (Number(input.duration) as 10 | 20 | 30 | 40) : null;
    if (!duration) {
      return { ok: false, error_code: "validation_failed", message: "duration must be 10, 20, 30, or 40 seconds." };
    }
    const aspectRatio: "9:16" | "1:1" | "16:9" = input.aspectRatio === "1:1" || input.aspectRatio === "16:9" ? input.aspectRatio : "9:16";
    const style = typeof input.style === "string" && input.style.trim() ? input.style : "cinematic";

    // Localize so the screenplay is written in the user's language (matches the
    // render tool). The stored brief carries the prefix so the render is consistent.
    const languageTag = await getUserPreferredLanguage(ctx.userId);
    const languageLabel = getLanguageLabel(languageTag);
    const localizedBrief = withLanguagePrefix(brief, languageTag);
    const localizedGoal = typeof input.goal === "string" && input.goal.trim() ? `${input.goal.trim()} (in ${languageLabel})` : undefined;
    const localizedCharacterBrief = typeof input.characterBrief === "string" && input.characterBrief.trim() ? `${input.characterBrief.trim()} (dialogue in ${languageLabel})` : undefined;
    const platforms = Array.isArray(input.platforms) ? input.platforms.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 6) : undefined;
    const destinationUrl = typeof input.destinationUrl === "string" && input.destinationUrl.trim() ? input.destinationUrl.trim() : undefined;

    const params = { brief: localizedBrief, rawBrief: brief, duration, aspectRatio, style, goal: localizedGoal ?? null, destinationUrl: destinationUrl ?? null, platforms: platforms ?? [], characterBrief: localizedCharacterBrief ?? null };

    let script: StoryAdMovieScript;
    try {
      script = await draftStoryAdScript({
        jobId: "", userId: ctx.userId,
        brief: localizedBrief, duration, aspectRatio, style,
        goal: localizedGoal, destinationUrl, platforms, characterBrief: localizedCharacterBrief,
      });
    } catch (e) {
      return { ok: false, error_code: "upstream_failed", message: `Couldn't draft the screenplay${e instanceof Error ? `: ${e.message.slice(0, 160)}` : ""}. Try again in a moment.` };
    }

    // Supersede a previous draft if this is a re-draft after a tweak.
    if (typeof input.replaceDraftId === "string" && input.replaceDraftId.trim()) {
      await prisma.design.deleteMany({ where: { id: input.replaceDraftId.trim(), userId: ctx.userId, type: DRAFT_TYPE } }).catch(() => {});
    }

    const row = await prisma.design.create({
      data: {
        userId: ctx.userId,
        prompt: brief.slice(0, 2000),
        category: "video",
        size: aspectRatio,
        name: (script.title || "Story ad").slice(0, 160),
        type: DRAFT_TYPE,
        status: "PENDING",
        canvasData: JSON.stringify({ script, params }),
      },
      select: { id: true },
    });

    const scenes = script.scenes.map((s) => ({ n: s.sceneNumber, narration: s.narration, caption: s.caption, visual: s.imagePrompt }));
    ctx.emit({ type: "agent_view", requestId: row.id, spec: scriptApprovalView({ draftId: row.id, title: script.title, duration, scenes }) });

    return {
      ok: true,
      data: {
        draftId: row.id,
        title: script.title,
        scenes: scenes.length,
        userMessage: `Drafted the screenplay and rendered an approval card in the chat (draftId: ${row.id}). STOP and wait — if the user APPROVES, call start_story_ad_campaign with draftId "${row.id}" (and a confirmed planId) to render it. If they ask to TWEAK it, call draft_story_ad_script again with the change folded into the brief and replaceDraftId "${row.id}". Do NOT re-list the script as text.`,
      },
    };
  },
};
