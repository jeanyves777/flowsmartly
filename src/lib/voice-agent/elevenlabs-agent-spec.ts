/**
 * Map a saved VoiceAgent row to an ElevenLabs Conversational AI agent payload.
 *
 * Built from the SAME source a call uses — `toSessionAgent` + `buildInstructions`
 * + `mcpToolsFor` — so the ElevenLabs agent, and any per-call session, can't
 * drift. The agent's skills become inline webhook tools that call our executor
 * (`/api/voice-agent/el-tool/{token}/{action}` → the real save_lead/place_order/…
 * writes), alongside the system end_call tool.
 */

import { toSessionAgent } from "@/lib/voice-agent/agent-sync";
import { buildInstructions } from "@/lib/voice-agent/session-config";
import { mcpToolsFor } from "@/lib/voice-agent/mcp-tools";
import type { ConvaiAgentPayload } from "@/lib/voice-agent/elevenlabs-convai";
import type { AgentSkill } from "@/lib/voice-agent/types";

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

const jParse = <T,>(v: unknown, f: T): T => {
  try {
    return typeof v === "string" ? (JSON.parse(v) as T) : f;
  } catch {
    return f;
  }
};

/** The agent's inline tools: system end_call + one webhook per business skill. */
function buildTools(skills: AgentSkill[], mcpToken: string | null): Array<Record<string, unknown>> {
  const tools: Array<Record<string, unknown>> = [
    { type: "system", name: "end_call", params: { system_tool_type: "end_call" } },
  ];
  if (!mcpToken) return tools;
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  // The profile is baked into the prompt already, so it needs no tool call.
  for (const t of mcpToolsFor(skills).filter((x) => x.name !== "get_business_profile")) {
    tools.push({
      type: "webhook",
      name: t.name,
      description: t.description,
      response_timeout_secs: 20,
      api_schema: {
        url: `${base}/api/voice-agent/el-tool/${mcpToken}/${t.name}`,
        method: "POST",
        request_body_schema: t.inputSchema,
      },
    });
  }
  return tools;
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
  const skills = jParse<AgentSkill[]>(row.skills, []);
  const tools = buildTools(skills, (row.mcpToken as string) || null);

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
          tools,
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
