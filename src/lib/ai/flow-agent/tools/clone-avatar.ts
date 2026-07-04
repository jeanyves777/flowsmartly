import type { FlowAgentTool } from "../registry";

/**
 * clone_avatar — guide the user through creating a reusable avatar (and cloned
 * voice) from a photo or short video, HeyGen-backed.
 *
 * Cloning a real person's likeness/voice is CONSENT-GATED: it requires a spoken
 * authorisation clip captured in the Avatar Studio, which the agent cannot
 * record on the user's behalf. So this tool doesn't create the clone itself —
 * it explains the options (Photo Avatar vs Instant/video Avatar + voice clone),
 * their credit cost, and points the user to the consent-gated flow. Non-mutating.
 * (Programmatic clone creation is a follow-up once the consent-capture flow ships.)
 * [[avatar-studio-heygen]]
 */
export const cloneAvatar: FlowAgentTool = {
  name: "clone_avatar",
  description:
    "Explain and guide creating a reusable AVATAR (and optionally a cloned VOICE) from the user's photo or a short video, in the Avatar Studio. Use this when the user asks to 'clone me', 'make an avatar of myself', 'use my face/voice'. Cloning a real person is CONSENT-GATED — it needs a spoken authorisation clip the user records in the Avatar Studio, so you cannot create the clone directly; instead tell them the options and cost and point them to the Avatar Studio's 'Create avatar' flow. Options: Photo Avatar (1 photo, instant, ~40 credits), Instant Avatar / digital twin (2-min video, ~300 credits), plus voice clone (Instant 30s ~30 credits, or Professional 1–3 min ~120 credits). Non-mutating.",
  input_schema: {
    type: "object",
    properties: {
      source: { type: "string", enum: ["photo", "video"], description: "Whether the user has a photo (instant) or a 2-min video (digital twin)." },
      wantVoiceClone: { type: "boolean", description: "Whether they also want to clone their voice." },
    },
    required: [],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN", // 0 — guidance only; the clone itself is charged in the studio flow.
  mutating: false,
  handler: async (input) => {
    const source = input.source === "video" ? "video" : input.source === "photo" ? "photo" : null;
    const wantVoice = input.wantVoiceClone === true;
    const pick = source === "photo"
      ? "a Photo Avatar from your single photo (instant, ~40 credits)"
      : source === "video"
        ? "an Instant Avatar / digital twin from your 2-minute video (~300 credits)"
        : "either a Photo Avatar (1 photo, instant, ~40 credits) or an Instant Avatar / digital twin (2-min video, ~300 credits)";
    const voiceLine = wantVoice
      ? " I'll also set up a voice clone (Instant from 30s of audio ~30 credits, or Professional from 1–3 min ~120 credits)."
      : "";
    return {
      ok: true,
      data: {
        userMessage:
          `To make your avatar I'll create ${pick}.${voiceLine} Because it's your likeness, HeyGen requires a short spoken consent clip — open the Avatar Studio's "Create avatar" flow to upload your photo/video and record the authorisation, and I'll take it from there. Explain this to the user in ONE short, friendly sentence and point them to the Avatar Studio.`,
      },
    };
  },
};
