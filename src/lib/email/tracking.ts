/**
 * Email Tracking Utilities
 * - Open tracking via 1x1 transparent GIF pixel
 * - Click tracking via link rewriting
 */

// 1x1 transparent GIF (smallest valid GIF)
export const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  );
}

/**
 * Inject a tracking pixel before </body> in HTML emails.
 * The pixel hits GET /api/track/open/[sendId] when the email is opened.
 */
export function injectTrackingPixel(html: string, sendId: string): string {
  const baseUrl = getBaseUrl();
  const pixelUrl = `${baseUrl}/api/track/open/${sendId}`;
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixelTag}</body>`);
  }
  return html + pixelTag;
}

/**
 * Rewrite <a href="..."> links to route through the click tracker.
 * Skips mailto:, tel:, anchors (#), and already-tracked URLs.
 */
export function rewriteLinksForTracking(html: string, sendId: string): string {
  const baseUrl = getBaseUrl();

  return html.replace(
    /<a\s([^>]*?)href="([^"]+)"([^>]*?)>/gi,
    (match, before: string, url: string, after: string) => {
      // Skip non-trackable URLs
      if (
        url.startsWith("mailto:") ||
        url.startsWith("tel:") ||
        url.startsWith("#") ||
        url.includes("/api/track/")
      ) {
        return match;
      }
      const trackUrl = `${baseUrl}/api/track/click/${sendId}?url=${encodeURIComponent(url)}`;
      return `<a ${before}href="${trackUrl}"${after}>`;
    }
  );
}

/**
 * Apply both open and click tracking to an HTML email.
 */
export function applyEmailTracking(html: string, sendId: string): string {
  let result = html;
  result = rewriteLinksForTracking(result, sendId);
  result = injectTrackingPixel(result, sendId);
  return result;
}
