/**
 * The V5 public API client.
 *
 * This is the first network call the public site makes — every other form on
 * the site hands its content to the visitor's mail client instead. Keep that
 * property in mind: a failure here is the visitor's only signal, so every
 * outcome below is a state the UI can render, never a thrown error.
 *
 * The contract is V5-native and stable. `/api/v1/*` is the V5 namespace; the
 * fact that a V4 process answers it today is infrastructure (an nginx
 * proxy_pass, see deploy/nginx-flowsmartly-v5.conf) and is deliberately
 * invisible here. Nothing in this file may reference a V4 endpoint, envelope
 * or field name — if it did, replacing the backend would become a frontend
 * change, which is the whole thing this indirection exists to prevent.
 */

/**
 * Empty in production: the site and the API share an origin, so a relative
 * path is correct and cannot drift from the deployed host.
 *
 * Set EXPO_PUBLIC_API_BASE_URL for local development, where `expo start`
 * serves the app from :8081 and the API lives elsewhere.
 *
 * This is read at build time on purpose. Deriving a base URL from
 * `window.location` in module scope or a `useState` initialiser is the
 * static-export hydration trap: the exported HTML is generated with one value
 * baked in and the client silently keeps it.
 */
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

/** Abandon a submission that has not answered in this long. */
const REQUEST_TIMEOUT_MS = 15_000;

export type LeadKind = 'early-access' | 'contact' | 'demo' | 'partner';

export type LeadInput = {
  kind: LeadKind;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message?: string;
  /** Page/campaign attribution. Defaults server-side from `kind`. */
  source?: string;
};

/**
 * Why a result type rather than exceptions: every one of these is a distinct
 * thing to say to the visitor, and `duplicate` in particular is a success from
 * their point of view — they are on the list — so it must not surface as an
 * error banner.
 */
export type LeadResult =
  | { ok: true; id: string }
  | {
      ok: false;
      code: 'invalid_request' | 'duplicate' | 'rate_limited' | 'server_error' | 'network';
      message: string;
      /** Field name -> message, when the server rejected specific inputs. */
      fields?: Record<string, string>;
    };

type ApiErrorBody = {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
};

type ApiLeadBody = { lead?: { id?: string; status?: string } };

/** Shown when the server gave us nothing usable to say. */
const FALLBACK_MESSAGE = 'Something went wrong. Please try again in a moment.';

export async function submitLead(input: LeadInput): Promise<LeadResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/v1/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  } catch {
    // Offline, DNS, CORS, or the 15s timeout above. The visitor can retry, and
    // saying so is more useful than naming the cause.
    return {
      ok: false,
      code: 'network',
      message: 'We could not reach the server. Check your connection and try again.',
    };
  } finally {
    clearTimeout(timeout);
  }

  // A proxy or rate limiter can answer with HTML, so never assume JSON parses.
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.ok) {
    const id = (body as ApiLeadBody | null)?.lead?.id;
    if (typeof id === 'string' && id.length > 0) return { ok: true, id };
    // 2xx without an id means the contract was not honoured. Treat it as a
    // failure rather than showing a success screen we cannot stand behind.
    return { ok: false, code: 'server_error', message: FALLBACK_MESSAGE };
  }

  const error = (body as ApiErrorBody | null)?.error;
  const message = error?.message || FALLBACK_MESSAGE;

  if (response.status === 409) {
    return { ok: false, code: 'duplicate', message, fields: error?.fields };
  }
  if (response.status === 429) {
    return {
      ok: false,
      code: 'rate_limited',
      message: 'Too many attempts just now. Please wait a moment and try again.',
    };
  }
  if (response.status === 400) {
    return { ok: false, code: 'invalid_request', message, fields: error?.fields };
  }
  return { ok: false, code: 'server_error', message };
}
