import type { FlowAgentTool } from "../registry";
import { startAvatarVideo, listAvatarsForUser, listVoicesForUser } from "@/lib/avatar-studio";
import { emptyAvatarState, type AvatarQuality, type AvatarAspect } from "@/lib/avatar-studio/types";

/**
 * create_avatar_video — render a HeyGen talking-avatar video from a script,
 * an avatar and a voice. Charges credits (dynamic, by quality × length) and
 * kicks off the render; it appears in the Avatar Studio canvas as it renders
 * and lands in the user's Media Library when done.
 *
 * Be conversational like HeyGen's own skill: INTERVIEW first (goal, tone,
 * length), WRITE a punchy script, and RECOMMEND a quality (Standard for social
 * /outreach; Avatar IV for photoreal hero/ad content) before calling this.
 * If the user hasn't named an avatar/voice, the account's first available ones
 * are used. Mutating — propose a plan first. [[avatar-studio-heygen]]
 */
export const createAvatarVideo: FlowAgentTool = {
  name: "create_avatar_video",
  description:
    "Render a talking-avatar video (HeyGen) from a SCRIPT spoken by an AVATAR in a chosen VOICE. Use this once you have written a script and know which avatar/voice + quality to use. Interview the user first (goal, tone, length), write the script yourself, and recommend a quality: 'standard' (fast, ~$1/min — social, outreach, campaigns) or 'avatar_iv' (photoreal, voice-driven expressions — hero & ad content). `aspect` is 9:16 (reels), 1:1, or 16:9. `lengthSeconds` is 15, 30, or 60. If `avatarId`/`voiceId` are omitted, the account's first available avatar/voice are used. Charges credits by quality × length. The render streams into the Avatar Studio and saves to the Media Library.",
  input_schema: {
    type: "object",
    properties: {
      script: { type: "string", description: "What the avatar says, verbatim. Write this for the user before calling." },
      avatarId: { type: "string", description: "HeyGen avatar id. Omit to use the account's first available avatar." },
      avatarName: { type: "string", description: "Display name of the chosen avatar (for labelling)." },
      voiceId: { type: "string", description: "HeyGen voice id. Omit to use the first available voice." },
      voiceName: { type: "string", description: "Display name of the chosen voice." },
      quality: { type: "string", enum: ["standard", "avatar_iv"], description: "standard = fast talking-avatar; avatar_iv = photoreal." },
      aspect: { type: "string", enum: ["9:16", "1:1", "16:9"], description: "Output aspect ratio. Default 9:16." },
      lengthSeconds: { type: "number", enum: [15, 30, 60], description: "Target length in seconds. Default 30." },
      brief: { type: "string", description: "Short label/summary of the video (optional)." },
    },
    required: ["script"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN", // 0 — the real per-render cost is charged inside startAvatarVideo.
  mutating: true,
  handler: async (input, ctx) => {
    const script = String(input.script || "").trim();
    if (!script) return { ok: false, error_code: "missing_input", message: "Write the script the avatar should say first." };

    // Resolve avatar/voice — fall back to the account's first available.
    let avatarId = String(input.avatarId || "").trim();
    let avatarName = String(input.avatarName || "").trim();
    let voiceId = String(input.voiceId || "").trim();
    let voiceName = String(input.voiceName || "").trim();

    if (!avatarId || !voiceId) {
      const [avatars, voices] = await Promise.all([listAvatarsForUser(), listVoicesForUser()]);
      if (!avatarId) { avatarId = avatars[0]?.id || ""; avatarName = avatarName || avatars[0]?.name || "Avatar"; }
      if (!voiceId) { voiceId = voices[0]?.id || ""; voiceName = voiceName || voices[0]?.name || "Voice"; }
    }
    if (!avatarId) return { ok: false, error_code: "upstream_failed", message: "No avatars are available. Configure HeyGen or create an avatar first." };
    if (!voiceId) return { ok: false, error_code: "upstream_failed", message: "No voices are available. Configure HeyGen first." };

    const quality: AvatarQuality = input.quality === "avatar_iv" ? "avatar_iv" : "standard";
    const aspect: AvatarAspect = input.aspect === "1:1" || input.aspect === "16:9" ? input.aspect : "9:16";
    const lengthSeconds = [15, 30, 60].includes(Number(input.lengthSeconds)) ? Number(input.lengthSeconds) : 30;

    const state = {
      ...emptyAvatarState(),
      brief: String(input.brief || script).trim().slice(0, 120),
      script: script.slice(0, 3500),
      avatarId, avatarName: avatarName || "Avatar",
      voiceId, voiceName: voiceName || "Voice",
      quality, aspect, lengthSeconds, mode: "talking" as const,
    };

    const result = await startAvatarVideo({ userId: ctx.userId, isAdmin: ctx.isAdmin, state });
    if (!result.ok) {
      const code = result.code === "insufficient_credits" || /credit/i.test(result.code)
        ? "insufficient_credits" as const
        : result.code.startsWith("missing_") ? "missing_input" as const : "internal" as const;
      return { ok: false, error_code: code, message: result.message };
    }

    return {
      ok: true,
      data: {
        id: result.id,
        creditCost: result.creditsCost,
        quality, aspect, lengthSeconds,
        userMessage: `Rendering a ${lengthSeconds}s ${quality === "avatar_iv" ? "photoreal (Avatar IV)" : "standard"} avatar video with ${avatarName} for ${result.creditsCost} credits. It's appearing in the Avatar Studio now and will save to your Library when done. Tell the user in ONE short sentence.`,
      },
      resultRefType: "CartoonVideo",
      resultRefId: result.id,
    };
  },
};
