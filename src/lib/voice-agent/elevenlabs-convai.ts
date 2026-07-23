/**
 * ElevenLabs Conversational AI client.
 *
 * Unlike xAI's agents endpoint (team-gated, console-only), ElevenLabs lets us
 * create and update a real agent programmatically, then attach phone / WhatsApp /
 * chat channels to it and read back every conversation. This is the thin REST
 * wrapper; the mapping from our VoiceAgent row lives in [[elevenlabs-agent-spec]].
 *
 * Auth: `xi-api-key`. Base: https://api.elevenlabs.io/v1/convai. Verified against
 * the live API (create → 200 with agent_id, delete → 204).
 */

const BASE = "https://api.elevenlabs.io/v1/convai";

function apiKey(): string | null {
  return process.env.ELEVENLABS_API_KEY || null;
}

export function isConvaiEnabled(): boolean {
  return !!apiKey();
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  const key = apiKey();
  if (!key) return { ok: false, error: "ElevenLabs is not configured", status: 0 };
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "xi-api-key": key,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error", status: 0 };
  }
  if (res.status === 204) return { ok: true, data: undefined as T };
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const detail = (json as { detail?: { message?: string } | string })?.detail;
    const message = typeof detail === "string" ? detail : detail?.message || `ElevenLabs ${res.status}`;
    return { ok: false, error: message, status: res.status };
  }
  return { ok: true, data: (json as T) ?? (undefined as T) };
}

// ── Agents ──────────────────────────────────────────────────────────────────

export interface ConvaiAgentPayload {
  name: string;
  conversation_config: Record<string, unknown>;
  platform_settings?: Record<string, unknown>;
  tags?: string[];
}

export interface ConvaiAgent {
  agent_id: string;
  name?: string;
  conversation_config?: Record<string, unknown>;
  phone_numbers?: unknown[];
  whatsapp_accounts?: unknown[];
}

export function createConvaiAgent(payload: ConvaiAgentPayload) {
  return call<{ agent_id: string }>("/agents/create", { method: "POST", body: JSON.stringify(payload) });
}

export function updateConvaiAgent(agentId: string, payload: Partial<ConvaiAgentPayload>) {
  return call<ConvaiAgent>(`/agents/${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getConvaiAgent(agentId: string) {
  return call<ConvaiAgent>(`/agents/${encodeURIComponent(agentId)}`);
}

export function deleteConvaiAgent(agentId: string) {
  return call<void>(`/agents/${encodeURIComponent(agentId)}`, { method: "DELETE" });
}

// ── Conversations (call logs / transcripts) ──────────────────────────────────

export interface ConvaiConversationSummary {
  conversation_id: string;
  agent_id: string;
  start_time_unix_secs?: number;
  call_duration_secs?: number;
  message_count?: number;
  status?: string;
  call_successful?: string;
  transcript_summary?: string;
  call_summary_title?: string;
  direction?: string;
  tool_names?: string[];
  conversation_initiation_source?: string;
}

export interface ConvaiTranscriptTurn {
  role?: string; // "user" | "agent"
  message?: string | null;
  time_in_call_secs?: number;
}

export interface ConvaiConversationDetail {
  conversation_id: string;
  status?: string;
  transcript?: ConvaiTranscriptTurn[];
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    termination_reason?: string;
    conversation_initiation_source?: string;
    phone_call?: { external_number?: string; phone_number?: string; agent_number?: string; direction?: string } | null;
    whatsapp?: Record<string, unknown> | null;
    sms?: Record<string, unknown> | null;
  };
  analysis?: { transcript_summary?: string; call_summary_title?: string; call_successful?: string };
}

export function listConvaiConversations(params: { agentId?: string; pageSize?: number; cursor?: string }) {
  const q = new URLSearchParams();
  if (params.agentId) q.set("agent_id", params.agentId);
  if (params.pageSize) q.set("page_size", String(params.pageSize));
  if (params.cursor) q.set("cursor", params.cursor);
  const qs = q.toString();
  return call<{ conversations: ConvaiConversationSummary[]; next_cursor?: string; has_more?: boolean }>(
    `/conversations${qs ? `?${qs}` : ""}`,
  );
}

export function getConvaiConversation(conversationId: string) {
  return call<ConvaiConversationDetail>(`/conversations/${encodeURIComponent(conversationId)}`);
}

// (Tools are attached inline in the agent's conversation_config — see
//  elevenlabs-agent-spec — so no standalone Tools API is needed.)

// ── Phone numbers (Phase 2 · telephony) ──────────────────────────────────────

export function listConvaiPhoneNumbers() {
  return call<{ phone_numbers?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>("/phone-numbers");
}

/** Import a SIP-trunk number (e.g. Telnyx). The trunk configs carry the
 *  termination URI + credentials the provider gave us; without them the number is
 *  created but can't route calls yet.
 *  ⚠️ The create payload keys are `inbound_trunk_config`/`outbound_trunk_config`
 *  (NOT `inbound_trunk`/`outbound_trunk` — those produce a bare, null-trunk number
 *  with supports_inbound=false), and SIP creds nest under `credentials:{username,
 *  password}`. Proven live 2026-07-23. Pass `agentId` to bind in the same call. */
export function importSipPhoneNumber(params: {
  phoneNumber: string;
  label: string;
  agentId?: string;
  inboundTrunkConfig?: Record<string, unknown>;
  outboundTrunkConfig?: Record<string, unknown>;
}) {
  return call<{ phone_number_id: string }>("/phone-numbers", {
    method: "POST",
    body: JSON.stringify({
      provider: "sip_trunk",
      phone_number: params.phoneNumber,
      label: params.label,
      ...(params.agentId ? { agent_id: params.agentId } : {}),
      ...(params.inboundTrunkConfig ? { inbound_trunk_config: params.inboundTrunkConfig } : {}),
      ...(params.outboundTrunkConfig ? { outbound_trunk_config: params.outboundTrunkConfig } : {}),
    }),
  });
}

/** Import a Twilio number (needs the Twilio SID + auth token). */
export function importTwilioPhoneNumber(params: {
  phoneNumber: string;
  label: string;
  sid: string;
  token: string;
}) {
  return call<{ phone_number_id: string }>("/phone-numbers", {
    method: "POST",
    body: JSON.stringify({
      provider: "twilio",
      phone_number: params.phoneNumber,
      label: params.label,
      sid: params.sid,
      token: params.token,
    }),
  });
}

/** Bind (or move) a number to an agent — verified: PATCH {agent_id}. */
export function assignConvaiNumberToAgent(phoneNumberId: string, agentId: string) {
  return call<{ phone_number_id: string }>(`/phone-numbers/${encodeURIComponent(phoneNumberId)}`, {
    method: "PATCH",
    body: JSON.stringify({ agent_id: agentId }),
  });
}

export function deleteConvaiPhoneNumber(phoneNumberId: string) {
  return call<void>(`/phone-numbers/${encodeURIComponent(phoneNumberId)}`, { method: "DELETE" });
}

// ── Outbound / batch calls (Phase 7) ─────────────────────────────────────────

/** Place a single outbound call from one of our numbers, over SIP or Twilio. */
export function outboundCall(params: {
  agentId: string;
  agentPhoneNumberId: string;
  toNumber: string;
  provider?: "sip_trunk" | "twilio";
  /** Replace the agent's stored (inbound) greeting for THIS call — used to give outbound calls a
   *  proper "I'm calling you" opener. Requires the agent to allow first_message overrides. */
  firstMessage?: string;
}) {
  const path = params.provider === "twilio" ? "/twilio/outbound-call" : "/sip-trunk/outbound-call";
  const body: Record<string, unknown> = {
    agent_id: params.agentId,
    agent_phone_number_id: params.agentPhoneNumberId,
    to_number: params.toNumber,
  };
  if (params.firstMessage) {
    body.conversation_initiation_client_data = {
      conversation_config_override: { agent: { first_message: params.firstMessage } },
    };
  }
  return call<{ conversation_id?: string; success?: boolean; message?: string }>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
