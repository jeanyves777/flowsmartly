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
  return call<Record<string, unknown>>(`/conversations/${encodeURIComponent(conversationId)}`);
}

// ── Phone numbers (Phase 2) ──────────────────────────────────────────────────

export function listConvaiPhoneNumbers() {
  return call<{ phone_numbers?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>("/phone-numbers");
}
