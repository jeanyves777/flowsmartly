import type { FlowAgentTool } from "../registry";
import {
  createCampaignRecord,
  planCharacterCatalog,
  planSceneGrid,
  updateCampaignState,
  getBrandSnapshot,
  chargeStoryAdCampaignUsage,
  totalCreditsForCampaign,
  type CampaignState,
} from "@/lib/story-ad-campaign";
import { emptyCampaignState } from "@/lib/story-ad-campaign/types";

const STYLES = ["cinematic", "3d", "narrated"];
const DURATIONS = [30, 60, 90];

/**
 * draft_story_ad_campaign — the agent skill behind the /home/video Video Studio.
 * DRAFTS a video ad campaign into the canvas as REVIEW cards WITHOUT rendering:
 * it plans the cast + a scene-by-scene script from the brief, then hands the
 * campaignId to the open canvas (via a `__storyad` canvas_update) so the brief,
 * cast and scene nodes appear for the user to review, edit, and generate on demand
 * (draft-first). Clip renders + the final composite are charged LATER, per the
 * user's clicks — this tool only charges the small planning cost.
 * [[video-studio-playground]] [[agent-writes-into-ui-element-not-chat]]
 */
export const draftStoryAdCampaign: FlowAgentTool = {
  name: "draft_story_ad_campaign",
  description:
    "Draft a VIDEO ad into the Video Studio (/home/video) canvas as review cards — WITHOUT rendering. Plans the cast (characters) + a scene-by-scene script from the brief, so the user reviews each node and generates the scene clips + final video ON DEMAND (draft-first). Use this when the user is on the Video Studio and asks you to plan/draft/make a video. Costs only the small planning charge (cast catalog + scene script); each clip render is charged later when the user generates it. `style`: 'cinematic' (live-action), '3d' (animated), or 'narrated' (stills + voiceover). `durationSeconds`: 30/60/90. Write the `brief` from the user's request.",
  input_schema: {
    type: "object",
    properties: {
      brief: { type: "string", description: "What the video advertises — the story/idea/product. Write this for the user from their request." },
      style: { type: "string", enum: ["cinematic", "3d", "narrated"], description: "Visual style. Default cinematic." },
      durationSeconds: { type: "number", enum: [30, 60, 90], description: "Video length in seconds. Default 30 (≈4 scenes)." },
      goal: { type: "string", description: "Optional marketing goal / CTA for the ad." },
      castCount: { type: "number", description: "How many characters to plan (2–8). Default 4." },
    },
    required: ["brief"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN", // 0 — the real planning charges happen inside via chargeStoryAdCampaignUsage.
  mutating: true,
  handler: async (input, ctx) => {
    const brief = String(input.brief || "").trim().slice(0, 1200);
    if (brief.length < 12) return { ok: false, error_code: "missing_input", message: "Ask the user what the video should advertise (a one-line brief)." };
    const style = STYLES.includes(String(input.style)) ? String(input.style) : "cinematic";
    const durationSeconds = DURATIONS.includes(Number(input.durationSeconds)) ? Number(input.durationSeconds) : 30;
    const castCount = Math.max(2, Math.min(8, Number(input.castCount) || 4));

    // 1. Create the campaign row (no render).
    const base = emptyCampaignState();
    const state = { ...base, style: style as typeof base.style, brief, durationSeconds: durationSeconds as typeof base.durationSeconds, goal: String(input.goal || base.goal).trim().slice(0, 400), phase: "CHARACTERS" as const };
    const creditsBudget = totalCreditsForCampaign(state.durationSeconds, state.clipLength);
    const job = await createCampaignRecord({ userId: ctx.userId, state, creditsBudget });
    const campaignId = job.id;
    const brand = await getBrandSnapshot(ctx.userId);

    // 2. Plan the cast (charged).
    const castCharge = await chargeStoryAdCampaignUsage({ userId: ctx.userId, isAdmin: ctx.isAdmin, costKey: "AI_STORY_CAMPAIGN_CATALOG", campaignId, description: "Story Ad: cast catalog (draft)" });
    if (!castCharge.ok) return { ok: false, error_code: "insufficient_credits", message: `Drafting the cast needs ${castCharge.required} credits (you have ${castCharge.available}).`, data: { campaignId } };
    let cur: CampaignState = state;
    try {
      const plan = await planCharacterCatalog(cur, brand, castCount);
      cur = await updateCampaignState(campaignId, ctx.userId, { characters: plan.characters, storyOutline: plan.storyOutline, ...(plan.narratorVoice ? { narratorVoice: plan.narratorVoice } : {}), phase: "CHARACTERS" });
    } catch {
      return { ok: false, error_code: "internal", message: "Couldn't draft the cast — tell the user and offer to retry.", data: { campaignId } };
    }

    // 3. Plan the scene-by-scene script (charged). Optional — the cast is drafted even if this fails.
    let scriptDrafted = false;
    const sceneCharge = await chargeStoryAdCampaignUsage({ userId: ctx.userId, isAdmin: ctx.isAdmin, costKey: "AI_STORY_CAMPAIGN_SCENES", campaignId, description: "Story Ad: scene script (draft)" });
    if (sceneCharge.ok) {
      try {
        const planned = await planSceneGrid(cur, brand);
        cur = await updateCampaignState(campaignId, ctx.userId, { clips: planned.clips, ...(planned.musicCues ? { musicCues: planned.musicCues } : {}), phase: "PROMPTS" });
        scriptDrafted = true;
      } catch { /* leave the cast drafted; user can plan scenes from the canvas */ }
    }

    // Hand the drafted campaign to the open Video Studio canvas so its nodes appear.
    ctx.emit({ type: "canvas_update", patch: { __storyad: { campaignId } } });

    return {
      ok: true,
      data: {
        campaignId,
        userMessage: `Drafted a ${style} ${durationSeconds}s video — the cast${scriptDrafted ? " and a scene-by-scene script are" : " is"} now on the Video Studio canvas as review cards. Tell the user to review them and generate each scene (and the final video) when ready; nothing is rendered yet. Say this in ONE short sentence.`,
      },
      resultRefType: "CartoonVideo",
      resultRefId: campaignId,
    };
  },
};
