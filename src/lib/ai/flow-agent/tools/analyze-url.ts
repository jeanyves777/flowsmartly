import type { FlowAgentTool } from "../registry";

/**
 * analyze_url — fetch a public web page and return its readable text so
 * the agent can actually look at a site the user references ("check this
 * site", "what does my competitor do", "pull the about copy from X").
 *
 * The agent is NOT boxed in: it has frontier models behind it, so once it
 * has the page text it can summarize, critique, extract contact info,
 * compare to the brand, draft matching content, etc. This tool just gives
 * it the raw material.
 *
 * Safety:
 *  - http/https only; blocks localhost, private/link-local IPs, and
 *    cloud metadata endpoints (SSRF guard).
 *  - 8s timeout, follows redirects, caps returned text at ~12k chars.
 *  - Strips scripts/styles/markup to plain text; never executes anything.
 *
 * Read-only. Charges a small credit (it's a real network fetch + parse).
 */
export const analyzeUrl: FlowAgentTool = {
  name: "analyze_url",
  description:
    "Fetch a public web page and return its readable text + title + meta description. Use this whenever the user references a website ('check this site', 'look at X', 'what does this competitor do', 'pull copy from this page'). After you get the text you can summarize it, critique it, extract contact info, compare it to the user's brand, or draft matching content — you are fully capable, don't refuse. Only works on public http/https pages.",
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string", description: "Full http(s) URL to fetch, e.g. https://example.com" },
    },
    required: ["url"],
  },
  plans: null,
  costKey: "AGENT_GET_CALENDAR", // 1 credit — a real network fetch + parse
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
            "User-Agent": "Mozilla/5.0 (compatible; FlowSmartlyBot/1.0; +https://flowsmartly.com)",
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

      if (!res.ok) {
        return {
          ok: false,
          error_code: "upstream_failed",
          message: `${parsed.hostname} returned HTTP ${res.status}. The page may be private, blocked, or down.`,
        };
      }

      const contentType = res.headers.get("content-type") ?? "";
      const html = (await res.text()).slice(0, 600_000); // hard read cap

      if (contentType.includes("application/json")) {
        return {
          ok: true,
          data: { url: parsed.toString(), contentType, json: safeTruncate(html, 12_000) },
        };
      }

      const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
      const metaDesc =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() ??
        html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1]?.trim() ??
        "";
      const text = htmlToText(html);

      return {
        ok: true,
        data: {
          url: parsed.toString(),
          title: title.slice(0, 200),
          metaDescription: metaDesc.slice(0, 400),
          text: safeTruncate(text, 12_000),
          truncated: text.length > 12_000,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to analyze URL",
      };
    }
  },
};

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // Cloud metadata + loopback + private ranges (basic SSRF guard).
  if (h === "169.254.169.254" || h === "metadata.google.internal") return true;
  if (/^127\./.test(h) || h === "0.0.0.0" || h === "::1") return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
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
  return s.length > max ? `${s.slice(0, max)}\n…(truncated)` : s;
}
