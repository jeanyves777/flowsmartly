/**
 * Cloudflare Turnstile server-side verification
 */

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || "";
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) {
    console.warn("[Turnstile] No secret key configured, skipping verification");
    return true; // Allow in development
  }

  if (!token) {
    console.warn("[Turnstile] Called with empty token — rejecting without hitting Cloudflare");
    return false;
  }

  try {
    const body: Record<string, string> = {
      secret: TURNSTILE_SECRET,
      response: token,
    };
    if (ip) body.remoteip = ip;

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.success) {
      // Log the exact Cloudflare error-codes array so we can diagnose
      // mismatch between site/secret keys, expired tokens, domain
      // restrictions, etc. Truncate the token in case it's sensitive.
      const tokenFingerprint = token ? `${token.slice(0, 10)}...${token.slice(-4)} (${token.length} chars)` : "empty";
      console.error(
        "[Turnstile] Verification failed",
        JSON.stringify({
          cloudflareResponse: data,
          tokenFingerprint,
          secretKeyPrefix: TURNSTILE_SECRET.slice(0, 8) + "...",
          ip: ip || "none",
        }),
      );
    }
    return data.success === true;
  } catch (err) {
    console.error("[Turnstile] Verification error:", err);
    return false;
  }
}
