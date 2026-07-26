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

/** The agent's inline tools: system end_call + native transfer + one webhook per skill. */
function buildTools(
  skills: AgentSkill[],
  mcpToken: string | null,
  escalation: { escalateTo?: string | null; escalateOnUpset?: boolean; escalateOnUnsure?: boolean },
): Array<Record<string, unknown>> {
  const tools: Array<Record<string, unknown>> = [
    { type: "system", name: "end_call", params: { system_tool_type: "end_call" } },
  ];

  // Real transfer to a human. The old "transfer_to_human" webhook only SPOKE the
  // number — the caller was never actually connected. EL's native transfer_to_number
  // bridges the caller to the escalation line (conference, works over the SIP trunk).
  // Added whenever an escalation number is set.
  const escalateTo = (escalation.escalateTo || "").trim();
  if (escalateTo) {
    const conds = ["the caller explicitly asks to speak to a human, a person, or a specific staff member"];
    if (escalation.escalateOnUpset) conds.push("the caller is clearly upset, angry or distressed");
    if (escalation.escalateOnUnsure) conds.push("you have tried twice and still can't help");
    tools.push({
      type: "system",
      name: "transfer_to_number",
      params: {
        system_tool_type: "transfer_to_number",
        transfers: [
          {
            transfer_destination: { type: "phone", phone_number: escalateTo },
            condition: `Transfer when ${conds.join(", or when ")}. First tell the caller you're connecting them.`,
            transfer_type: "conference",
          },
        ],
      },
    });
  }

  if (!mcpToken) return tools;
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  // Profile is baked into the prompt; transfer is the native tool above (skip the
  // old text-only transfer_to_human webhook).
  for (const t of mcpToolsFor(skills).filter((x) => x.name !== "get_business_profile" && x.name !== "transfer_to_human")) {
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
  const tools = buildTools(skills, (row.mcpToken as string) || null, {
    escalateTo: row.escalateTo as string | null,
    escalateOnUpset: row.escalateOnUpset as boolean,
    escalateOnUnsure: row.escalateOnUnsure as boolean,
  });

  // Extra languages the agent also speaks → EL language presets (it greets and
  // converses in each). The primary stays `language`.
  const extra = jParse<string[]>(row.languages, [])
    .map((c) => resolveLanguage(c))
    .filter((c) => c && c !== language);
  const languagePresets: Record<string, unknown> = {};
  for (const code of Array.from(new Set(extra))) languagePresets[code] = { overrides: {} };

  // Live cap: hard-limit a single call's length so a stuck/looping call can't run
  // away. Scaled to the agent's remaining budget (≈15 cr/min), floored at 2 min,
  // capped at 20 min. This is the real-time guard our per-period spend cap can't
  // enforce inside EL's runtime.
  const maxCallSec = Math.min(1200, Math.max(120, Math.floor(Number(row.spendCapCredits ?? 5000) / 15) * 60));

  // Knowledge base — the EL docs created from the business's URLs (see
  // elevenlabs-sync.ensureKnowledgeDocs). Attaching them + enabling RAG lets the
  // agent ANSWER from the real content, not just recite the source names.
  const kbDocs = jParse<{ url: string; id: string; name: string }[]>(row.knowledgeDocs, []);
  const knowledgeBase = kbDocs.map((d) => ({ type: "url", name: d.name, id: d.id, usage_mode: "auto" }));

  return {
    name,
    conversation_config: {
      agent: {
        first_message: greeting, // "" → the agent waits for the caller to speak
        language,
        max_conversation_duration_seconds: maxCallSec,
        prompt: {
          prompt: instructions,
          llm: DEFAULT_LLM,
          temperature: 0.3,
          tools,
          ...(knowledgeBase.length ? { knowledge_base: knowledgeBase, rag: { enabled: true } } : {}),
        },
      },
      conversation: { max_duration_seconds: maxCallSec },
      ...(Object.keys(languagePresets).length ? { language_presets: languagePresets } : {}),
      tts: {
        voice_id: voiceId,
        model_id: DEFAULT_TTS_MODEL,
        speed,
        stability: 0.5,
        similarity_boost: 0.75,
      },
    },
    // Allow per-call overrides so an OUTBOUND call can (a) open with its own
    // greeting instead of the inbound "Thanks for calling …", and (b) run a
    // prompt that knows the agent is the CALLER with a goal — not a receptionist
    // waiting to help. EL only honours overrides that are enabled here.
    platform_settings: {
      overrides: {
        conversation_config_override: {
          agent: { first_message: true, prompt: { prompt: true } },
        },
      },
    },
    tags: ["flowsmartly"],
  };
}
