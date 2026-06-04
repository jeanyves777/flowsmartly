import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db/client";
import { isAllowedMobileRedirect } from "@/lib/auth/mobile-oauth";

/**
 * Shared helpers for the social-account CONNECT OAuth flow (publishing
 * channels: Facebook Pages, Instagram, LinkedIn, TikTok, Twitter/X, YouTube,
 * Pinterest, WhatsApp).
 *
 * The web flow authenticates the connect request via the session cookie. The
 * native mobile app opens these routes inside an in-app browser, which carries
 * NEITHER the session cookie NOR an `Authorization: Bearer` header — so the
 * old `getSession()`-only check returned 401 "Unauthorized" on mobile.
 *
 * To fix that, mobile passes its short-lived access token as a `?token=` query
 * param (the only way to authenticate a browser navigation) plus
 * `?platform=mobile&redirect=<app deep link>` so the callback can hand the
 * result back to the app instead of landing on the web page.
 *
 * SECURITY:
 *  - The token is a 15-min access JWT, sent over TLS to our own server only; it
 *    is NEVER forwarded to the OAuth provider (only the opaque `state` is).
 *  - `redirect` must be a known app scheme (validated by isAllowedMobileRedirect)
 *    so this can't be turned into an open redirect that leaks the OAuth result.
 *  - The provider `state` carries the mobile redirect base round-trip without
 *    relying on cookies surviving the third-party redirect.
 */

/**
 * Resolve the connecting user from EITHER the session (cookie / Bearer header,
 * web) OR a `?token=` access-token query param (mobile in-app browser).
 * Returns the userId, or null if neither authenticates a live user.
 */
export async function resolveConnectUserId(request: NextRequest): Promise<string | null> {
  // Web (cookie) or any caller that sets Authorization: Bearer.
  const session = await getSession();
  if (session) return session.userId;

  // Mobile in-app browser: access token passed as a query param.
  const token = request.nextUrl.searchParams.get("token");
  if (token) {
    const payload = await verifyAccessToken(token);
    if (payload?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, deletedAt: true },
      });
      if (user && !user.deletedAt) return user.id;
    }
  }

  return null;
}

/**
 * If this connect request came from the native app, return the validated app
 * deep-link base to send the result to. Web requests return undefined.
 */
export function getMobileConnectRedirect(request: NextRequest): string | undefined {
  const platform = request.nextUrl.searchParams.get("platform");
  if (platform !== "mobile") return undefined;
  const redirect = request.nextUrl.searchParams.get("redirect");
  return isAllowedMobileRedirect(redirect) ? redirect! : undefined;
}

export interface ConnectState {
  userId: string;
  /** Per-platform extra packed into legacy state — PKCE verifier (Twitter) or CSRF nonce (Pinterest). */
  extra?: string;
  /** App deep-link base, present only for mobile-initiated connects. */
  mobileRedirect?: string;
}

const MOBILE_STATE_PREFIX = "m1.";

/**
 * Encode the OAuth `state` param.
 *
 * Backward compatible: WEB requests (no mobileRedirect) keep the exact legacy
 * format — plain `userId`, or `userId:extra` for Twitter/Pinterest — so nothing
 * about the web flow changes. Only mobile-initiated connects use the new
 * base64url envelope (which also carries the deep-link redirect).
 */
export function encodeConnectState(state: ConnectState): string {
  if (state.mobileRedirect) {
    const json = JSON.stringify({ u: state.userId, e: state.extra, r: state.mobileRedirect });
    return MOBILE_STATE_PREFIX + Buffer.from(json, "utf8").toString("base64url");
  }
  return state.extra ? `${state.userId}:${state.extra}` : state.userId;
}

/**
 * Decode an OAuth `state` param produced by encodeConnectState — handles both
 * the new mobile envelope and every legacy format (`userId`, `userId:extra`).
 */
export function decodeConnectState(raw: string | null | undefined): ConnectState {
  if (!raw) return { userId: "" };

  if (raw.startsWith(MOBILE_STATE_PREFIX)) {
    try {
      const json = Buffer.from(raw.slice(MOBILE_STATE_PREFIX.length), "base64url").toString("utf8");
      const o = JSON.parse(json) as { u?: string; e?: string; r?: string };
      return {
        userId: o.u || "",
        extra: o.e || undefined,
        mobileRedirect: isAllowedMobileRedirect(o.r) ? o.r : undefined,
      };
    } catch {
      return { userId: "" };
    }
  }

  // Legacy: "userId" or "userId:extra". userIds/verifiers/nonces never contain ":".
  const idx = raw.indexOf(":");
  if (idx === -1) return { userId: raw };
  return { userId: raw.slice(0, idx), extra: raw.slice(idx + 1) };
}

/**
 * Redirect the OAuth callback result to the right place: the app deep link for
 * a mobile-initiated connect, otherwise the web `/social-accounts` page. The
 * same `success`/`error` query params are appended in both cases.
 */
export function connectResultRedirect(
  mobileRedirect: string | undefined,
  params: Record<string, string>,
  webPath: string = "/social-accounts",
): NextResponse {
  const base =
    mobileRedirect && isAllowedMobileRedirect(mobileRedirect)
      ? mobileRedirect
      : `${process.env.NEXT_PUBLIC_APP_URL}${webPath}`;
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url.toString());
}
