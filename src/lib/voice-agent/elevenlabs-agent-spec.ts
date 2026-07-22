/**
 * Map a saved VoiceAgent row to an ElevenLabs Conversational AI agent payload.
 *
 * Built from the SAME source a call uses — `toSessionAgent` + `buildInstructions`
 * — so the ElevenLabs agent, and any per-call session, can't drift. The agent's
 * tools/actions ride our MCP relay (attached separately in Phase 3); here we set
 * the brain (prompt), the opener, the voice, speech, and language.
 */

import { toSessionAgent } from "@/lib/voice-agent/agent-sync";
import { buildInstructions } from "@/lib/voice-agent/session-config";
import type { ConvaiAgentPayload } from "@/lib/voice-agent/elevenlabs-convai";

// A neutral, professional default when the row has no ElevenLabs voice of its own
// (our phone voiceId is often an xAI voice name, which EL wouldn't accept).
const DEFAULT_EL_VOICE = "21m00Tcm4TlvDq8ikWAM"; // Rachel — clear, warm, business-appropriate
const DEFAULT_LLM = "gemini-2.0-flash-001";
const DEFAULT_TTS_MODEL = "eleven_flash_v2";

/** An ElevenLabs voice id is a 20-char alphanumeric handle; our xAI names aren't. */
function resolveVoiceId(voiceId: string | null | undefined): string {
  return voiceId && /^[A-Za-z0-9]{20}$/.test(voiceId) ? voiceId : DEFAULT_EL_VOICE;
}

/** EL wants a 2-letter language; our hint may be "auto" or a BCP-47 tag. */
function resolveLanguage(hint: string | null | undefined): string {
  if (!hint || hint === "auto") return "en";
  return hint.slice(0, 2).toLowerCase();
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Build the create/update payload. `row` is a raw VoiceAgent record.
 */
export function buildElevenLabsAgent(row: Record<string, unknown>): ConvaiAgentPayload {
  const sessionAgent = toSessionAgent(row);
  const instructions = buildInstructions(sessionAgent);

  const name = String(row.name || "Phone agent");
  const greeting = String(row.greeting || "");
  const language = resolveLanguage(row.languageHint as string);
  const voiceId = resolveVoiceId(row.voiceId as string);
  const speed = clamp(Number(row.speakingSpeed ?? 1), 0.7, 1.2);

  return {
    name,
    conversation_config: {
      agent: {
        first_message: greeting, // "" → the agent waits for the caller to speak
        language,
        prompt: {
          prompt: instructions,
          llm: DEFAULT_LLM,
          temperature: 0.3,
          // end_call is always available so the agent can hang up cleanly. Business
          // actions (booking/orders/leads) arrive via the MCP relay in Phase 3.
          tools: [{ type: "system", name: "end_call", params: { system_tool_type: "end_call" } }],
        },
      },
      tts: {
        voice_id: voiceId,
        model_id: DEFAULT_TTS_MODEL,
        speed,
        stability: 0.5,
        similarity_boost: 0.75,
      },
    },
    tags: ["flowsmartly"],
  };
}
