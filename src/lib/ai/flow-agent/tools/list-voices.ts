import { isElevenLabsEnabled, listVoices } from "@/lib/voice/elevenlabs-client";
import type { FlowAgentTool } from "../registry";

/**
 * list_voices — return the ElevenLabs voices available on the platform so
 * the agent can present them to the user to pick a narrator / per-character
 * voice before generating narrated audio. Read-only, free.
 *
 * The agent should call this when the user wants narrated audio / a
 * voice conversation, show the options (name + gender/accent from labels),
 * let the user choose, then call generate_narration with the picked
 * voiceId(s).
 */
export const listVoicesTool: FlowAgentTool = {
  name: "list_voices",
  description:
    "List the available AI voices (ElevenLabs) so the user can choose a narrator or per-character voice. Call this when the user wants to turn text into narrated audio or a male/female voice conversation. Present the voices (name + gender/accent labels) and ask which to use — one voice for a single narrator, or one per character for a conversation. Then call generate_narration with the chosen voiceId(s).",
  input_schema: {
    type: "object",
    properties: {
      gender: { type: "string", description: "Optional filter: 'male' | 'female' (matched against voice labels)." },
    },
  },
  plans: null,
  costKey: "AGENT_LIST_FEATURES", // free
  mutating: false,
  handler: async (input) => {
    try {
      if (!isElevenLabsEnabled()) {
        return {
          ok: false,
          error_code: "upstream_failed",
          message: "AI voices aren't configured on this environment. Tell the user narrated audio isn't available right now.",
        };
      }
      const voices = await listVoices();
      const genderFilter = typeof input.gender === "string" ? input.gender.toLowerCase() : null;
      const mapped = voices
        .map((v) => ({
          voiceId: v.voiceId,
          name: v.name,
          gender: (v.labels?.gender ?? "").toLowerCase() || undefined,
          accent: v.labels?.accent || undefined,
          description: v.description || undefined,
          category: v.category,
        }))
        .filter((v) => (genderFilter ? v.gender === genderFilter : true));
      return {
        ok: true,
        data: {
          count: mapped.length,
          voices: mapped.slice(0, 40),
          guidance:
            "Show these to the user. For a single narrator pick ONE voiceId. For a conversation, pick a voiceId per character (e.g. a male + a female). Then call generate_narration.",
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to list voices",
      };
    }
  },
};
