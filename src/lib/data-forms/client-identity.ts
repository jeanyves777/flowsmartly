/**
 * Deriving the caller's address for rate limiting.
 *
 * A rate limit keyed on a header the caller controls is not a rate limit. Our
 * ingress (see `deploy/nginx-maintenance.conf`) sets:
 *
 *   proxy_set_header X-Real-IP       $remote_addr;
 *   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 *
 * `X-Real-IP` is *overwritten* every hop with the TCP peer nginx actually sees,
 * so it is trustworthy. `X-Forwarded-For` is *appended* to — whatever the caller
 * sent survives at the front of the list, which is why reading the leftmost
 * value (as this code previously did) let a caller rotate a fake address on
 * every request and never be limited. Only the value our own proxy appended,
 * the LAST one, means anything.
 */

/** Header our ingress overwrites. Override only if the ingress changes. */
const TRUSTED_HEADER = process.env.TRUSTED_CLIENT_IP_HEADER || "x-real-ip";

/** Used when no ingress header is present at all (direct connection / dev). */
export const UNTRUSTED_IDENTITY = "untrusted";

export interface ClientIdentity {
  /** Bucket key for rate limiting. */
  identity: string;
  /** False when no ingress-written header was present. */
  trusted: boolean;
}

export function clientIdentity(headers: Headers): ClientIdentity {
  const real = headers.get(TRUSTED_HEADER)?.trim();
  if (real) return { identity: real, trusted: true };

  // Fall back to the value our own proxy appended — the rightmost entry, never
  // the leftmost, which is caller-supplied.
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const nearest = parts[parts.length - 1];
    if (nearest) return { identity: nearest, trusted: true };
  }

  // No ingress header: everyone shares one bucket rather than each caller
  // getting a free one. Conservative on purpose.
  return { identity: UNTRUSTED_IDENTITY, trusted: false };
}
