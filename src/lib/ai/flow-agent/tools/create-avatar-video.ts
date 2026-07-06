import type { FlowAgentTool } from "../registry";
import { startAvatarVideo, startAvatarVideoBatch, listAvatarsForUser, listVoicesForUser, findCompletedAvatarVideo } from "@/lib/avatar-studio";
import { emptyAvatarState, type AvatarQuality, type AvatarAspect } from "@/lib/avatar-studio/types";

/**
 * create_avatar_video — the agent skill behind the Avatar Studio. Handles the
 * agent-triggerable modes and streams the render(s) into the studio canvas live
 * (they appear as render nodes and update as they render, then land in the
 * Media Library) — same live-feedback pattern as the Video Studio.
 *
 *  - "talking" (default): a talking-avatar video from a SCRIPT + avatar + voice.
 *  - "translate": dub one of the user's finished videos into another language.
 *  - "batch": many talking videos at once, one per script line.
 *  (Photo → video needs the user to upload a photo in the studio UI.)
 *
 * Be conversational like HeyGen's own skill: INTERVIEW first (goal, tone,
 * length), WRITE the script, RECOMMEND a quality. Costs are metered in credits
 * (priced from the DB/admin); never quote a dollar figure. Mutating — propose a
 * plan first. [[avatar-studio-heygen]] [[agent-writes-into-ui-element-not-chat]]
 */
export const createAvatarVideo: FlowAgentTool = {
  name: "create_avatar_video",
  description:
    "Create HeyGen avatar videos in the Avatar Studio — they stream into the studio canvas live and save to the Media Library. Modes: 'talking' (default) renders a talking-avatar video from a SCRIPT spoken by an avatar+voice; 'translate' dubs one of the user's FINISHED videos into another language (set `targetLanguage` and optionally `sourceVideoQuery` to pick which video by title, else the latest); 'batch' renders many talking videos at once (pass `scripts` — one per video — with a shared avatar/voice). Interview the user first, write the script(s), and recommend a quality: 'standard' (fast — social/outreach) or 'avatar_iv' (photoreal — hero/ads). Costs are metered in credits (DB/admin priced by quality × length); never quote a dollar figure. `aspect` 9:16/1:1/16:9, `lengthSeconds` 15/30/60. If avatar/voice are omitted, the account's first available are used. (For 'photo → video' the user uploads a photo in the studio UI.)",
  input_schema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["talking", "translate", "batch"], description: "What to make. Default 'talking'." },
      script: { type: "string", description: "talking: what the avatar says, verbatim. Write this for the user." },
      scripts: { type: "array", items: { type: "string" }, description: "batch: one script per video (each line becomes its own video)." },
      targetLanguage: { type: "string", description: "translate: language to dub into (e.g. Spanish, French, Japanese)." },
      sourceVideoQuery: { type: "string", description: "translate: pick the source video by a word from its title, or 'latest'." },
      avatarId: { type: "string", description: "HeyGen avatar id. Omit to use the account's first available avatar." },
      avatarName: { type: "string", description: "Display name of the chosen avatar (for labelling)." },
      voiceId: { type: "string", description: "HeyGen voice id. Omit to use the first available voice." },
      voiceName: { type: "string", description: "Display name of the chosen voice." },
      quality: { type: "string", enum: ["standard", "avatar_iv"], description: "standard = fast talking-avatar; avatar_iv = photoreal." },
      aspect: { type: "string", enum: ["9:16", "1:1", "16:9"], description: "Output aspect ratio. Default 9:16." },
      lengthSeconds: { type: "number", enum: [15, 30, 60], description: "Target length in seconds. Default 30." },
      brief: { type: "string", description: "Short label/summary of the video (optional)." },
    },
    required: [],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN", // 0 — the real per-render cost is charged inside the lib.
  mutating: true,
  handler: async (input, ctx) => {
    const mode = input.mode === "translate" || input.mode === "batch" ? input.mode : "talking";
    const quality: AvatarQuality = input.quality === "avatar_iv" ? "avatar_iv" : "standard";
    const aspect: AvatarAspect = input.aspect === "1:1" || input.aspect === "16:9" ? input.aspect : "9:16";
    const lengthSeconds = [15, 30, 60].includes(Number(input.lengthSeconds)) ? Number(input.lengthSeconds) : 30;

    // ---- Translate: dub a finished video ----
    if (mode === "translate") {
      const targetLanguage = String(input.targetLanguage || "").trim();
      if (!targetLanguage) return { ok: false, error_code: "missing_input", message: "Ask the user which language to translate into." };
      const source = await findCompletedAvatarVideo(ctx.userId, String(input.sourceVideoQuery || ""));
      if (!source) return { ok: false, error_code: "not_found", message: "No finished avatar video to translate yet — make one first." };
      const res = await startAvatarVideo({
        userId: ctx.userId, isAdmin: ctx.isAdmin,
        state: { ...emptyAvatarState(), mode: "translate", sourceVideoUrl: source.videoUrl, targetLanguage, brief: `Translate: ${source.title} → ${targetLanguage}` },
      });
      if (!res.ok) return { ok: false, error_code: /credit/i.test(res.code) ? "insufficient_credits" : "internal", message: res.message };
      return {
        ok: true,
        data: { id: res.id, creditCost: res.creditsCost, userMessage: `Translating "${source.title}" into ${targetLanguage} for ${res.creditsCost} credits — it's rendering in the Avatar Studio now. Say so in ONE short sentence.` },
        resultRefType: "CartoonVideo", resultRefId: res.id,
      };
    }

    // Resolve avatar/voice defaults for talking + batch.
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

    const base = { ...emptyAvatarState(), avatarId, avatarName: avatarName || "Avatar", voiceId, voiceName: voiceName || "Voice", quality, aspect, lengthSeconds };

    // ---- Batch: many videos at once ----
    if (mode === "batch") {
      const scripts = Array.isArray(input.scripts) ? (input.scripts as unknown[]).map((s) => String(s || "")).filter((s) => s.trim()) : [];
      if (scripts.length === 0) return { ok: false, error_code: "missing_input", message: "Provide the list of scripts (one per video) for the batch." };
      const res = await startAvatarVideoBatch({ userId: ctx.userId, isAdmin: ctx.isAdmin, scripts, base });
      if (res.error && res.started.length === 0) return { ok: false, error_code: /credit/i.test(res.error) ? "insufficient_credits" : "internal", message: res.error };
      return {
        ok: true,
        data: { started: res.started.length, creditCost: res.totalCredits, userMessage: `Rendering ${res.started.length} avatar videos with ${avatarName} for ${res.totalCredits} credits total — they're streaming into the Avatar Studio now${res.error ? ` (stopped early: ${res.error})` : ""}. Say so in ONE short sentence.` },
      };
    }

    // ---- Talking (default) ----
    const script = String(input.script || "").trim();
    if (!script) return { ok: false, error_code: "missing_input", message: "Write the script the avatar should say first." };
    const res = await startAvatarVideo({
      userId: ctx.userId, isAdmin: ctx.isAdmin,
      state: { ...base, brief: String(input.brief || script).trim().slice(0, 120), script: script.slice(0, 3500), mode: "talking" },
    });
    if (!res.ok) {
      const code = /credit/i.test(res.code) ? "insufficient_credits" as const : res.code.startsWith("missing_") ? "missing_input" as const : "internal" as const;
      return { ok: false, error_code: code, message: res.message };
    }
    return {
      ok: true,
      data: { id: res.id, creditCost: res.creditsCost, quality, aspect, lengthSeconds, userMessage: `Rendering a ${lengthSeconds}s ${quality === "avatar_iv" ? "photoreal (Avatar IV)" : "standard"} avatar video with ${avatarName} for ${res.creditsCost} credits — it's appearing in the Avatar Studio now and saves to your Library when done. Say so in ONE short sentence.` },
      resultRefType: "CartoonVideo", resultRefId: res.id,
    };
  },
};
