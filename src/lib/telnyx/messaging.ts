/**
 * Telnyx SMS/MMS client.
 *
 * The messaging half of our Telnyx integration (the voice half wires numbers to
 * ElevenLabs). Mirrors the shape of the legacy Twilio `sendSMS` so callers can be
 * swapped one at a time. Auth: `TELNYX_API_KEY`. Sends run through a shared
 * messaging profile (`TELNYX_MESSAGING_PROFILE_ID`).
 *
 * NOTE: US A2P 10DLC — long-code SMS to US numbers must belong to a registered
 * 10DLC campaign or carriers filter it. Number provisioning + brand/campaign
 * registration live in the (forthcoming) telnyx number module; this file only
 * sends + reports.
 */

const BASE = "https://api.telnyx.com/v2";

function apiKey(): string | null {
  return process.env.TELNYX_API_KEY || null;
}

export function isTelnyxSmsEnabled(): boolean {
  return !!apiKey();
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  const key = apiKey();
  if (!key) return { ok: false, error: "Telnyx is not configured", status: 0 };
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error", status: 0 };
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const errs = (json as { errors?: Array<{ detail?: string; title?: string }> })?.errors;
    const message = errs?.[0]?.detail || errs?.[0]?.title || `Telnyx ${res.status}`;
    return { ok: false, error: message, status: res.status };
  }
  return { ok: true, data: (json as { data?: T })?.data ?? (json as T) };
}

// ── Send ──────────────────────────────────────────────────────────────────────

export interface SendResult {
  success: boolean;
  messageId?: string;
  parts?: number; // SMS segments
  error?: string;
}

/**
 * Send one SMS/MMS. `from` is our E.164 sender; media makes it an MMS.
 * Shape mirrors the legacy Twilio sendSMS so call sites swap cleanly.
 */
export async function sendTelnyxSms(params: {
  from: string;
  to: string;
  text: string;
  mediaUrls?: string[];
  webhookUrl?: string;
}): Promise<SendResult> {
  const profileId = process.env.TELNYX_MESSAGING_PROFILE_ID || undefined;
  const r = await call<{ id: string; parts?: number }>("/messages", {
    method: "POST",
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      text: params.text,
      ...(params.mediaUrls?.length ? { media_urls: params.mediaUrls } : {}),
      ...(profileId ? { messaging_profile_id: profileId } : {}),
      ...(params.webhookUrl ? { webhook_url: params.webhookUrl, use_profile_webhooks: false } : {}),
    }),
  });
  if (!r.ok) return { success: false, error: r.error };
  return { success: true, messageId: r.data.id, parts: r.data.parts };
}

/** Send the same body to many recipients (sequential, gently throttled). */
export async function sendTelnyxBulk(
  from: string,
  recipients: Array<{ to: string; text: string; mediaUrls?: string[] }>,
  opts?: { webhookUrl?: string; delayMs?: number },
): Promise<Array<SendResult & { to: string }>> {
  const out: Array<SendResult & { to: string }> = [];
  for (const r of recipients) {
    const res = await sendTelnyxSms({ from, to: r.to, text: r.text, mediaUrls: r.mediaUrls, webhookUrl: opts?.webhookUrl });
    out.push({ ...res, to: r.to });
    if (opts?.delayMs) await new Promise((ok) => setTimeout(ok, opts.delayMs));
  }
  return out;
}

// ── Messaging profile ──────────────────────────────────────────────────────────

/** Ensure a shared messaging profile exists; returns its id (env id preferred). */
export async function ensureMessagingProfile(name = "FlowSmartly SMS"): Promise<string | null> {
  const envId = process.env.TELNYX_MESSAGING_PROFILE_ID;
  if (envId) return envId;
  const list = await call<Array<{ id: string; name: string }>>("/messaging_profiles?page[size]=50");
  if (list.ok) {
    const found = list.data.find((p) => p.name === name);
    if (found) return found.id;
  }
  const created = await call<{ id: string }>("/messaging_profiles", {
    method: "POST",
    body: JSON.stringify({ name, whitelisted_destinations: ["US"] }),
  });
  return created.ok ? created.data.id : null;
}
