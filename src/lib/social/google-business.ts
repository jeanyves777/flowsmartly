/**
 * Google Business Profile posting via the Business Profile API `localPosts.create`.
 *
 * The location's resource name (`accounts/{acc}/locations/{loc}`) is stored on the
 * SocialAccount as `platformUserId` at connect time, so a post is a single POST to
 * `v4/{parent}/localPosts`.
 *
 * NOTE: access to the Business Profile APIs is allow-listed by Google — until this
 * app's Cloud project is approved, calls return 403 / SERVICE_DISABLED. We surface
 * that as an honest "awaiting approval" hold (never a fake "Published").
 */

interface GBAccount {
  platformUserId: string | null; // "accounts/{acc}/locations/{loc}"
  platformDisplayName: string | null;
  scopes: string;
}

interface GBResult {
  success: boolean;
  postId?: string;
  error?: string;
  /** Connected & valid, but not live yet (awaiting Google API access approval). */
  pending?: boolean;
}

const VIDEO_RE = /\.(mp4|webm|mov|avi|mkv)/i;

export async function publishToGoogleBusiness(
  post: { caption: string | null; mediaUrls: string[] },
  account: GBAccount,
  token: string | null
): Promise<GBResult> {
  if (!token) {
    return { success: false, error: "Missing or expired Google Business token. Please reconnect." };
  }

  const parent = account.platformUserId;
  if (!parent || !parent.includes("locations/")) {
    return { success: false, error: "No Google Business location connected. Reconnect Google Business Profile." };
  }

  const summary = (post.caption || "").slice(0, 1500);
  const imageUrl = post.mediaUrls.find((u) => !VIDEO_RE.test(u));
  if (!summary.trim() && !imageUrl) {
    return { success: false, error: "Add a caption or a photo for your Google Business post." };
  }

  const body: Record<string, unknown> = {
    languageCode: "en-US",
    summary,
    topicType: "STANDARD",
  };
  // Business Profile local posts take images only (no video).
  if (imageUrl) {
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: imageUrl }];
  }

  try {
    const res = await fetch(`https://mybusiness.googleapis.com/v4/${parent}/localPosts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      return { success: true, postId: j.name };
    }

    const err = await res.json().catch(() => ({}));
    const msg: string = err?.error?.message || `Google Business post failed (${res.status})`;

    // App not yet approved for the Business Profile APIs → honest "awaiting approval" hold.
    if (
      res.status === 403 ||
      res.status === 429 ||
      /has not been used|is disabled|SERVICE_DISABLED|PERMISSION_DENIED|accessNotConfigured|quota|not authorized/i.test(msg)
    ) {
      return {
        success: false,
        pending: true,
        error:
          "Google Business Profile is connected — posting is awaiting Google's API access approval for this app. It'll post automatically once granted.",
      };
    }

    if (res.status === 401 || /invalid authentication|invalid_grant|access token|unauthenticated/i.test(msg)) {
      return { success: false, error: "Your Google Business connection expired. Reconnect it and try again." };
    }

    return { success: false, error: msg };
  } catch (e: any) {
    return { success: false, error: e?.message || "Google Business post failed" };
  }
}
