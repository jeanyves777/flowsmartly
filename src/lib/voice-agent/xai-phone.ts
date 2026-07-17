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

function key(): string | null {
  return process.env.XAI_API_KEY || null;
}

async function call<T>(
  path: string,
  init: RequestInit & { body?: string } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const k = key();
  if (!k) return { ok: false, error: "Voice calling isn't configured yet.", status: 503 };

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
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
