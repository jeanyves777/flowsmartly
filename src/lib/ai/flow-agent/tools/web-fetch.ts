import type { FlowAgentTool } from "../registry";

/**
 * web_fetch — pull a specific public web page and return its readable text +
 * title + meta description.
 *
 * Built as a CLIENT tool (no external provider dependency) so it works on a
 * vanilla install. Use this when the user pastes a URL, asks you to summarize
 * a page, or asks you to dig deeper into a specific result returned by
 * `web_search`.
 *
 * Differs from `analyze_url` only in name + the fact that it pairs with
 * `web_search` as the "browse the web" capability the agent exposes. Same
 * SSRF guard, same text-strip pipeline.
 *
 * Safety:
 *  - http/https only.
 *  - Blocks loopback (127.*, 0.0.0.0, ::1), private RFC 1918 ranges (10.*,
 *    172.16-31.*, 192.168.*), link-local (169.254.*, fe80::), cloud metadata
 *    endpoints, and any *.local / *.internal hostname (SSRF guard).
 *  - 8s timeout, follows redirects, caps returned text at ~12k chars and
 *    raw response read at 1 MB.
 *  - Strips scripts/styles/markup to plain text; never executes anything.
 */
export const webFetch: FlowAgentTool = {
  name: "web_fetch",
  description:
    "Fetch a specific public web page by URL and return its readable text + title + meta description. Use this when the user pastes a link ('summarize this', 'what does this page say', 'look at this article'), or when you want to dig into a specific result that web_search returned. Public http/https only. After you get the page text you can summarize it, extract facts, quote it, compare it to the brand — you are fully capable, don't refuse. Cite the URL as a Markdown link in your reply.",
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string", description: "Full http(s) URL to fetch, e.g. https://example.com/article" },
    },
    required: ["url"],
  },
  plans: null,
  costKey: "AI_WEB_FETCH",
  mutating: false,
  handler: async (input) => {
    try {
      let raw = typeof input.url === "string" ? input.url.trim() : "";
      if (!raw) {
        return { ok: false, error_code: "missing_input", message: "url is required" };
      }
      if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        return { ok: false, error_code: "validation_failed", message: `Not a valid URL: ${raw}` };
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error_code: "validation_failed", message: "Only http/https URLs are supported." };
      }
      if (isBlockedHost(parsed.hostname)) {
        return {
          ok: false,
          error_code: "permission_denied",
          message: "That host isn't allowed (local/private network).",
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let res: Response;
      try {
        res = await fetch(parsed.toString(), {
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; FlowSmartly/Flow-AI; +https://flowsmartly.com)",
            Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
          },
        });
      } catch (e) {
        return {
          ok: false,
          error_code: "upstream_failed",
          message: `Couldn't reach ${parsed.hostname}: ${e instanceof Error ? e.message : "request failed"}. Tell the user the site didn't respond.`,
        };
      } finally {
        clearTimeout(timeout);
      }

      const contentType = res.headers.get("content-type") ?? "";
      const status = res.status;

      // Read up to 1 MB raw; abort beyond that to bound memory.
      const raw1mb = await readCapped(res, 1_000_000);

      if (!res.ok) {
        return {
          ok: false,
          error_code: "upstream_failed",
          message: `${parsed.hostname} returned HTTP ${status}. The page may be private, blocked, or down.`,
        };
      }

      if (contentType.includes("application/json")) {
        return {
          ok: true,
          data: {
            url: parsed.toString(),
            title: parsed.hostname,
            text: safeTruncate(raw1mb, 12_000),
            contentType,
            status,
          },
        };
      }

      const title = (raw1mb.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
      const metaDesc =
        raw1mb.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() ??
        raw1mb.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1]?.trim() ??
        "";
      const text = htmlToText(raw1mb);

      return {
        ok: true,
        data: {
          url: parsed.toString(),
          title: title.slice(0, 200),
          metaDescription: metaDesc.slice(0, 400),
          text: safeTruncate(text, 12_000),
          truncated: text.length > 12_000,
          contentType,
          status,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to fetch URL",
      };
    }
  },
};

/**
 * SSRF guard — block hostnames that resolve to (or already look like) any
 * private/internal range. Hostname matching only; for a fully bulletproof
 * guard you'd resolve DNS and re-check, but cap at hostname-string level here
 * (matches the existing analyze_url tool and is good enough for a public-URL
 * convenience).
 *
 * Blocks:
 *  - localhost, *.local, *.internal hostnames
 *  - Cloud metadata endpoints: 169.254.169.254 (AWS/Azure), metadata.google.internal (GCP)
 *  - IPv4 loopback: 127.0.0.0/8, 0.0.0.0
 *  - IPv4 private: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 *  - IPv4 link-local: 169.254.0.0/16
 *  - IPv6 loopback: ::1
 *  - IPv6 link-local: fe80::/10
 *  - IPv6 unique-local: fc00::/7 (fc00–fdff)
 */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // Cloud metadata
  if (h === "169.254.169.254" || h === "metadata.google.internal" || h === "metadata") return true;
  // IPv4 loopback + unspecified
  if (/^127\./.test(h) || h === "0.0.0.0") return true;
  // IPv4 private ranges
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  // IPv4 link-local
  if (/^169\.254\./.test(h)) return true;
  // IPv6 loopback + link-local + unique-local
  if (h === "::1" || h === "::") return true;
  if (/^fe[89ab][0-9a-f]?:/i.test(h)) return true; // fe80::/10
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true;  // fc00::/7
  return false;
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  // Stream and stop once we hit cap; falls back to text() if no stream.
  if (!res.body) return (await res.text()).slice(0, maxBytes);
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let received = 0;
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (received >= maxBytes) {
      try { await reader.cancel(); } catch { /* ignore */ }
      break;
    }
  }
  out += decoder.decode();
  return out;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeTruncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}\n…truncated…` : s;
}
