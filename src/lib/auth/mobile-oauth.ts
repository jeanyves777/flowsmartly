/**
 * Helpers for returning an OAuth result to the native app via a deep link.
 *
 * The app passes its own redirect base (`Linking.createURL("auth")`), which is
 * `flowsmartly://auth` in a standalone build but `exp://<lan>/--/auth` inside
 * Expo Go. We echo the tokens onto that base so social login works in both.
 *
 * SECURITY: only known app schemes are allowed so this can't be turned into an
 * open redirect that leaks tokens to an arbitrary URL. In PRODUCTION only the
 * standalone `flowsmartly://` scheme is accepted; the Expo Go schemes
 * (`exp:`/`exp+...:`) are permitted ONLY outside production so social login can
 * still be tested in Expo Go during local development.
 */

const ALLOWED_SCHEMES =
  process.env.NODE_ENV === "production"
    ? ["flowsmartly:"]
    : ["flowsmartly:", "exp:", "exp+flowsmartly:"];
const DEFAULT_BASE = "flowsmartly://auth";

export function isAllowedMobileRedirect(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return ALLOWED_SCHEMES.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function buildMobileRedirect(
  base: string | undefined | null,
  params: { accessToken?: string; refreshToken?: string; error?: string },
): string {
  const safeBase = isAllowedMobileRedirect(base) ? (base as string) : DEFAULT_BASE;
  const qs = new URLSearchParams();
  if (params.accessToken) qs.set("accessToken", params.accessToken);
  if (params.refreshToken) qs.set("refreshToken", params.refreshToken);
  if (params.error) qs.set("error", params.error);
  const sep = safeBase.includes("?") ? "&" : "?";
  return `${safeBase}${sep}${qs.toString()}`;
}
