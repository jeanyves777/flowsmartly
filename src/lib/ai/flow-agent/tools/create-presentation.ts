import type { FlowAgentTool } from "../registry";
import { draftPresentation, generatePresentationRender, listAvatarsForUser, listVoicesForUser } from "@/lib/avatar-studio";
import { emptyAvatarState, MAX_PRESENTATION_SCENES, type AvatarQuality, type AvatarAspect } from "@/lib/avatar-studio/types";

/**
 * create_presentation — the agent skill behind Presentation mode in the Avatar
 * Studio. Plans a multi-scene presentation (avatar + product/B-roll scenes) that
 * renders as ONE stitched video. The draft appears as a Presentation node on the
 * studio canvas which opens a storyboard editor; the user attaches per-scene
 * visuals (their AI/library) and renders when ready.
 *
 * INTERVIEW first (goal, audience, how many scenes, what product/visuals to show),
 * then plan. Drafting is FREE; rendering the whole video charges once (credits,
 * DB/admin-priced — never a dollar figure). Set autoRender only if the user
 * explicitly asked you to render it now. [[avatar-studio-heygen]]
 */
export const createPresentation: FlowAgentTool = {
  name: "create_presentation",
  description:
    "Plan a multi-scene PRESENTATION in the Avatar Studio — one stitched video where a presenter avatar talks and product/reference images or B-roll play between or behind them (per scene: full avatar, avatar corner-overlay on a visual, or a full-screen cut-away with voiceover). Drafting the scene plan is FREE and appears as a Presentation node on the studio canvas (opens a storyboard editor where the user attaches visuals and renders). Interview first: goal, audience, scene count, and what products/visuals to showcase. Costs are credits (DB/admin priced by quality × total length; never quote dollars). Only set autoRender=true if the user explicitly asked to render it now; otherwise leave the plan for them to review and render from the storyboard. If avatar/voice are omitted, the account's first available are used.",
  input_schema: {
    type: "object",
    properties: {
      brief: { type: "string", description: "What the presentation is about — the goal, product, and key beats. The planner writes each scene's script from this." },
      sceneCount: { type: "number", description: `How many scenes to plan (2–${MAX_PRESENTATION_SCENES}). Default 5.` },
      avatarId: { type: "string", description: "HeyGen avatar id for the presenter. Omit to use the account's first available." },
      avatarName: { type: "string", description: "Display name of the chosen avatar (for labelling)." },
      voiceId: { type: "string", description: "HeyGen voice id. Omit to use the first available voice." },
      voiceName: { type: "string", description: "Display name of the chosen voice." },
      quality: { type: "string", enum: ["standard", "avatar_iv"], description: "standard = fast; avatar_iv = photoreal presenter." },
      aspect: { type: "string", enum: ["9:16", "1:1", "16:9"], description: "Output aspect ratio. Default 9:16." },
      autoRender: { type: "boolean", description: "Render the whole presentation immediately (charges credits). Only if the user explicitly asked." },
    },
    required: ["brief"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN", // 0 — the real render cost is charged inside the lib on render.
  mutating: true,
  handler: async (input, ctx) => {
    const brief = String(input.brief || "").trim();
    if (!brief) return { ok: false, error_code: "missing_input", message: "Ask the user what the presentation should be about first." };
    const sceneCount = Math.max(2, Math.min(MAX_PRESENTATION_SCENES, Math.round(Number(input.sceneCount) || 5)));
    const quality: AvatarQuality = input.quality === "avatar_iv" ? "avatar_iv" : "standard";
    const aspect: AvatarAspect = input.aspect === "1:1" || input.aspect === "16:9" ? input.aspect : "9:16";

    // Resolve avatar/voice defaults.
    let avatarId = String(input.avatarId || "").trim();
    let avatarName = String(input.avatarName || "").trim();
    let voiceId = String(input.voiceId || "").trim();
    let voiceName = String(input.voiceName || "").trim();
    if (!avatarId || !voiceId) {
      const [avatars, voices] = await Promise.all([listAvatarsForUser(), listVoicesForUser()]);
      if (!avatarId) { avatarId = avatars[0]?.id || ""; avatarName = avatarName || avatars[0]?.name || "Avatar"; }
      if (!voiceId) { voiceId = voices[0]?.id || ""; voiceName = voiceName || voices[0]?.name || "Voice"; }
    }
    if (!avatarId || !voiceId) return { ok: false, error_code: "upstream_failed", message: "No avatars/voices available. Configure HeyGen first." };

    const base = { ...emptyAvatarState(), avatarId, avatarName: avatarName || "Avatar", voiceId, voiceName: voiceName || "Voice", quality, aspect, captionsOn: true, mode: "presentation" as const };
    const { id, scenes } = await draftPresentation({ userId: ctx.userId, brief, sceneCount, base });

    if (input.autoRender) {
      const res = await generatePresentationRender(id, ctx.userId, ctx.isAdmin);
      if (!res.ok) {
        const code = /credit/i.test(res.code) ? "insufficient_credits" as const : "internal" as const;
        return { ok: false, error_code: code, message: res.message, data: { id } };
      }
      return {
        ok: true,
        data: { id, scenes: scenes.length, creditCost: res.creditsCost, userMessage: `Rendering a ${scenes.length}-scene presentation with ${avatarName} for ${res.creditsCost} credits — it's stitching into one video in the Avatar Studio now and saves to your Library when done. Say so in ONE short sentence.` },
        resultRefType: "CartoonVideo", resultRefId: id,
      };
    }

    return {
      ok: true,
      data: { id, scenes: scenes.length, userMessage: `Planned a ${scenes.length}-scene presentation with ${avatarName} — it's on the Avatar Studio canvas as a Presentation node. Tell the user to open it to add per-scene visuals (products/B-roll) and render the whole video. Say this in ONE short sentence.` },
      resultRefType: "CartoonVideo", resultRefId: id,
    };
  },
};
