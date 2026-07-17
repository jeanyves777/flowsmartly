/**
 * Telephony for the Voice Agent — xAI, not Twilio.
 *
 * xAI terminates the SIP leg and bridges the caller's audio into the realtime
 * session itself, so there is no media stream to proxy and nothing to transcode.
 * A call arrives as a signed `realtime.call.incoming` webhook carrying a
 * `call_id`; we open `wss://api.x.ai/v1/realtime?call_id=…`, push that business's
 * brief with `session.update`, and xAI does the rest.
 *
 * Two ways a business gets a line, and the API treats them very differently
 * (probed 2026-07-17, endpoint is /v2 — /v1/phone-numbers is a different, gated thing):
 *
 *   origin "xai_provisioned" — POST is REFUSED: "Provisioning xAI phone numbers via
 *     the API is not supported. Use the console (Voice Agents) instead." So this
 *     path CANNOT be automated: the user asks, an admin adds the number in the
 *     console, and we reconcile it back by listing. GET/list works fine.
 *
 *   origin "byo_trunk" — fully automatable. Returns `sip_host` to point their
 *     carrier at, and a `dispatch_signing_secret` that is returned ONCE.
 */

const BASE = "https://api.x.ai";

/** Inference key — realtime WS, TTS/STT, voices. */
function key(): string | null {
  return process.env.XAI_API_KEY || null;
}

/**
 * Management key — the agent-management + number-management API (`prod.mc.*`)
 * lives behind a separate MANAGEMENT key, not the inference API key. Falls back
 * to the inference key so behaviour is unchanged until a management key is set;
 * once `XAI_MANAGEMENT_KEY` exists, /v1/agents and number binding start working.
 */
function mgmtKey(): string | null {
  return process.env.XAI_MANAGEMENT_KEY || process.env.XAI_API_KEY || null;
}

async function call<T>(
  path: string,
  init: RequestInit & { body?: string; management?: boolean } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const { management, ...reqInit } = init;
  const k = management ? mgmtKey() : key();
  if (!k) return { ok: false, error: "Voice calling isn't configured yet.", status: 503 };

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...reqInit,
      headers: {
        Authorization: `Bearer ${k}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    const body = text ? safeJson(text) : null;

    if (!res.ok) {
      const raw =
        (body as { error?: string; code?: string } | null)?.error ||
        (body as { code?: string } | null)?.code ||
        text.slice(0, 200) ||
        `HTTP ${res.status}`;
      return { ok: false, error: raw, status: res.status };
    }
    return { ok: true, data: (body ?? {}) as T };
  } catch (e) {
    console.error(`[xai-phone] ${path} failed:`, e);
    return { ok: false, error: "Could not reach the calling service.", status: 502 };
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ── Types (mirroring what the API actually returns, camelCase) ──

export type XaiOrigin = "xai_provisioned" | "byo_trunk";

export interface XaiPhoneNumber {
  phoneNumberId: string;
  phoneNumber?: string;
  name?: string;
  origin?: XaiOrigin;
  agentId?: string | null;
  teamId?: string;
  sipHost?: string;
  updateTime?: string;
}

// ── Numbers ──

/**
 * Every number on the team, from both paths.
 *
 * This is how an admin-added console number gets back to the right tenant: the
 * admin names it with our request id, and we reconcile by listing. There is no
 * push notification when a console number appears.
 */
export async function listXaiNumbers(): Promise<
  { ok: true; numbers: XaiPhoneNumber[] } | { ok: false; error: string }
> {
  const r = await call<{ phoneNumbers?: XaiPhoneNumber[] }>("/v2/phone-numbers");
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, numbers: r.data.phoneNumbers || [] };
}

export async function getXaiNumber(
  phoneNumberId: string,
): Promise<{ ok: true; number: XaiPhoneNumber } | { ok: false; error: string }> {
  const r = await call<XaiPhoneNumber>(`/v2/phone-numbers/${encodeURIComponent(phoneNumberId)}`);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, number: r.data };
}

/**
 * Register a number the business already owns, by SIP trunk. Fully automated.
 *
 * `dispatchSigningSecret` comes back ONCE and never again — persist it in the
 * same transaction that stores the number, or inbound calls can never be
 * verified and the number has to be deleted and re-registered.
 */
export async function registerByoNumber(params: {
  phoneNumber: string;
  name: string;
  webhookUrl: string;
  webhookAuthToken: string;
  sipUsername: string;
  sipPassword: string;
  agentId?: string;
}): Promise<
  | { ok: true; number: XaiPhoneNumber & { dispatchSigningSecret?: string } }
  | { ok: false; error: string; alreadyRegistered?: boolean }
> {
  const r = await call<XaiPhoneNumber & { dispatchSigningSecret?: string; webhookId?: string }>(
    "/v2/phone-numbers",
    {
      method: "POST",
      body: JSON.stringify({
        origin: "byo_trunk",
        name: params.name,
        phone_number: params.phoneNumber,
        ...(params.agentId ? { agent_id: params.agentId } : {}),
        webhook: { url: params.webhookUrl, auth_token: params.webhookAuthToken },
        sip_auth: { auth_username: params.sipUsername, auth_password: params.sipPassword },
      }),
    },
  );

  if (!r.ok) {
    // A number can only be registered once across xAI, so this is the one error
    // worth naming: it's the user's own number, and they need to know it's
    // attached somewhere else rather than see a generic failure.
    const alreadyRegistered = /already (registered|exists)/i.test(r.error);
    return { ok: false, error: r.error, alreadyRegistered };
  }
  return { ok: true, number: r.data };
}

export async function deleteXaiNumber(
  phoneNumberId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await call(`/v2/phone-numbers/${encodeURIComponent(phoneNumberId)}`, { method: "DELETE" });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// ── Live calls ──

/** End a call in progress. */
export async function hangupCall(callId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await call(`/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`, { method: "POST" });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Transfer a call to a human — this is what the "transfer to a human" skill does. */
export async function referCall(
  callId: string,
  destination: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await call(`/v1/realtime/calls/${encodeURIComponent(callId)}/refer`, {
    method: "POST",
    body: JSON.stringify({ target_uri: destination.startsWith("sip:") ? destination : `tel:${destination}` }),
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** The socket the bridge opens once a call arrives. */
export function realtimeCallUrl(callId: string): string {
  return `wss://api.x.ai/v1/realtime?call_id=${encodeURIComponent(callId)}`;
}

// ── Console agents ──
//
// `/v1/agents` is the real endpoint (a 403 there vs a 404 on a bad path proves
// it exists) but it returns "agents endpoint is not enabled for this team" until
// the team turns the agents feature on. So `notEnabled` is a first-class result:
// callers fall back to the webhook + per-call session.update path, which needs no
// console agent. The request shape follows the OpenAI-compatible realtime agent
// (name/model/instructions/voice/tools) since xAI's realtime is OpenAI-compatible;
// it's unverified while the endpoint is gated, and validated the moment it's on.

export interface XaiAgentSpec {
  name: string;
  instructions: string;
  voice: string;
  tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
}

type SyncResult =
  | { ok: true; agentId: string }
  | { ok: false; notEnabled: true }
  | { ok: false; notEnabled?: false; error: string };

function agentBody(spec: XaiAgentSpec) {
  // Schema discovered from the endpoint's own 422s (2026-07-17): top-level
  // {name, instructions, voice, tools, collection_ids, workflow_json}; `voice`
  // is a struct {voice_id, vad_threshold, vad_silence_duration_ms, model,
  // language_hint, reasoning…}, NOT a plain string. `model` is a Voice field,
  // not top-level.
  return {
    name: spec.name.slice(0, 120),
    instructions: spec.instructions,
    voice: { voice_id: spec.voice || "eve" },
    // A tool is a tagged union keyed by its type (function | web_search | …),
    // NOT {type:"function"} — the agent-mgmt API differs from the realtime one.
    // And `parameters` is a JSON-encoded STRING here, not an object.
    tools: spec.tools.map((t) => ({
      function: { name: t.name, description: t.description, parameters: JSON.stringify(t.parameters) },
    })),
  };
}

/** Create or update the console agent that mirrors one of our DB agents. */
export async function syncXaiAgent(xaiAgentId: string | null, spec: XaiAgentSpec): Promise<SyncResult> {
  const path = xaiAgentId ? `/v1/agents/${encodeURIComponent(xaiAgentId)}` : "/v1/agents";
  const method = xaiAgentId ? "PATCH" : "POST";
  const r = await call<{ agent_id?: string; agentId?: string; id?: string }>(path, {
    method,
    management: true,
    body: JSON.stringify(agentBody(spec)),
  });

  if (!r.ok) {
    if (r.status === 403 && /not enabled/i.test(r.error)) return { ok: false, notEnabled: true };
    // A gone agent on update → treat as "create next time".
    if (r.status === 404 && xaiAgentId) return { ok: false, error: "agent no longer exists" };
    return { ok: false, error: r.error };
  }
  const id = r.data.agent_id || r.data.agentId || r.data.id || xaiAgentId || "";
  if (!id) return { ok: false, error: "no agent id returned" };
  return { ok: true, agentId: id };
}

export async function deleteXaiAgent(xaiAgentId: string): Promise<{ ok: boolean }> {
  const r = await call(`/v1/agents/${encodeURIComponent(xaiAgentId)}`, { method: "DELETE", management: true });
  return { ok: r.ok };
}

/**
 * Point a number at an agent, or at our webhook. The number-update API only
 * accepts a `field_mask`-style body, so we send both the field and the mask.
 * Returns notEnabled/error so callers can degrade to the webhook path.
 */
export async function bindNumberToAgent(
  phoneNumberId: string,
  xaiAgentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await call(`/v2/phone-numbers/${encodeURIComponent(phoneNumberId)}`, {
    method: "PATCH",
    management: true,
    body: JSON.stringify({ agent_id: xaiAgentId, field_mask: "agent_id" }),
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// ── Voices ──

export interface VoiceOption {
  voiceId: string;
  name: string;
  gender?: string;
  language?: string;
  kind: "builtin" | "cloned";
}

/** Built-in voices + the team's cloned voices, merged. */
export async function listVoices(): Promise<
  { ok: true; voices: VoiceOption[] } | { ok: false; error: string }
> {
  const [builtin, custom] = await Promise.all([
    call<{ voices?: Array<{ voice_id: string; name: string; gender?: string; language?: string }> }>(
      "/v1/tts/voices",
    ),
    call<{ voices?: Array<{ voice_id: string; name: string; gender?: string; language?: string }> }>(
      "/v1/custom-voices",
    ),
  ]);

  if (!builtin.ok) return { ok: false, error: builtin.error };

  const map = (
    v: { voice_id: string; name: string; gender?: string; language?: string },
    kind: "builtin" | "cloned",
  ): VoiceOption => ({
    voiceId: v.voice_id,
    name: v.name,
    gender: v.gender,
    language: v.language,
    kind,
  });

  const voices = [
    ...(custom.ok ? (custom.data.voices || []).map((v) => map(v, "cloned")) : []),
    ...(builtin.data.voices || []).map((v) => map(v, "builtin")),
  ];
  return { ok: true, voices };
}

/**
 * Clone a voice from a reference clip (≤120s). Returns a voice id usable
 * everywhere a built-in voice id is. Console gives 30 free; the API create is
 * Enterprise-gated, so this surfaces that limit as a clear message rather than a
 * raw 403.
 */
export async function cloneVoice(params: {
  audio: Buffer;
  filename: string;
  contentType: string;
  name: string;
  language?: string;
  gender?: string;
}): Promise<{ ok: true; voiceId: string; name: string } | { ok: false; error: string; gated?: boolean }> {
  const k = key();
  if (!k) return { ok: false, error: "Voice cloning isn't configured yet." };

  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(params.audio)], { type: params.contentType }), params.filename);
    form.append("name", params.name);
    if (params.language) form.append("language", params.language);
    if (params.gender) form.append("gender", params.gender);

    const res = await fetch(`${BASE}/v1/custom-voices`, {
      method: "POST",
      headers: { Authorization: `Bearer ${k}` }, // no Content-Type — let fetch set the boundary
      body: form,
    });
    const text = await res.text();
    const body = text ? (safeJson(text) as { voice_id?: string; name?: string; error?: string; code?: string } | null) : null;

    if (!res.ok) {
      const raw = body?.error || body?.code || text.slice(0, 200) || `HTTP ${res.status}`;
      // Create is Enterprise-gated; the console path (30 free) still works.
      const gated = res.status === 403 || /enterprise|not enabled|permission/i.test(raw);
      return { ok: false, error: raw, gated };
    }
    if (!body?.voice_id) return { ok: false, error: "Cloning didn't return a voice." };
    return { ok: true, voiceId: body.voice_id, name: body.name || params.name };
  } catch (e) {
    console.error("[xai-phone] cloneVoice failed:", e);
    return { ok: false, error: "Could not reach the voice service." };
  }
}

export async function deleteClonedVoice(
  voiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await call(`/v1/custom-voices/${encodeURIComponent(voiceId)}`, { method: "DELETE" });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Speak a short line so the user can hear a voice before choosing it. */
export async function ttsPreview(
  voiceId: string,
  text: string,
): Promise<{ ok: true; audio: Buffer; contentType: string } | { ok: false; error: string }> {
  const k = key();
  if (!k) return { ok: false, error: "Voice preview isn't configured yet." };

  try {
    const res = await fetch(`${BASE}/v1/tts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice_id: voiceId, language: "en" }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: t.slice(0, 200) || `HTTP ${res.status}` };
    }

    // /v1/tts returns base64 audio in JSON, OR raw audio bytes — handle both.
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = (await res.json()) as { audio?: string; content_type?: string };
      if (!j.audio) return { ok: false, error: "No audio returned." };
      return { ok: true, audio: Buffer.from(j.audio, "base64"), contentType: j.content_type || "audio/mpeg" };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: true, audio: buf, contentType: ct || "audio/mpeg" };
  } catch (e) {
    console.error("[xai-phone] ttsPreview failed:", e);
    return { ok: false, error: "Could not reach the voice service." };
  }
}
