import type { FlowAgentTool } from "../registry";

/**
 * web_search — search the public web and return ranked results so the agent
 * can answer questions about CURRENT events, prices, schedules, news, etc.
 *
 * Provider chain (chosen at registration time by which API key is in `.env`):
 *  1. Tavily (TAVILY_API_KEY)   — best signal for AI use cases, includes
 *                                 an `answer` synthesis we pass through.
 *  2. Brave  (BRAVE_API_KEY)    — solid organic results, no synthesis.
 *  3. Serper (SERPER_API_KEY)   — Google-backed organic results.
 *
 * If no key is present, the tool is NOT registered (see ./web-search-tool.ts
 * registration logic in registry.ts) — the agent then only has `web_fetch`
 * for direct-URL lookups.
 *
 * Returns: `{ results: [{ title, url, snippet, publishedAt? }], answer? }`.
 * The agent should cite each result it uses as a Markdown link inline.
 */

export type SearchProvider = "tavily" | "brave" | "serper";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

export interface WebSearchPayload {
  query: string;
  provider: SearchProvider;
  results: WebSearchResult[];
  answer?: string;
}

/**
 * Pick the first available provider key from process.env at registration
 * time. Returns null when none is configured — the tool should then be
 * skipped, NOT registered with a stub handler.
 */
export function detectSearchProvider(): SearchProvider | null {
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.BRAVE_API_KEY) return "brave";
  if (process.env.SERPER_API_KEY) return "serper";
  return null;
}

export function buildWebSearchTool(provider: SearchProvider): FlowAgentTool {
  return {
    name: "web_search",
    description:
      "Search the public web for CURRENT information — news, sports schedules, prices, releases, recent events, anything you're not 100% sure your training data covers. Returns up to N ranked results with title, URL, and snippet. After you get results, you can either answer directly with citations or call web_fetch on the most relevant URL to read the full page. ALWAYS cite the sources you use as Markdown links inline (e.g. 'FIFA confirmed it ([source](https://...))'). Use proactively whenever the user asks about something time-sensitive — don't say 'I can't browse the web', you can.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query — plain natural language is fine." },
        max_results: {
          type: "integer",
          description: "How many results to return (1-10, default 5).",
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["query"],
    },
    plans: null,
    costKey: "AI_WEB_SEARCH",
    mutating: false,
    handler: async (input) => {
      const query = typeof input.query === "string" ? input.query.trim() : "";
      if (!query) {
        return { ok: false, error_code: "missing_input", message: "query is required" };
      }
      const maxResults = clamp(
        typeof input.max_results === "number" ? input.max_results : 5,
        1,
        10,
      );

      try {
        const payload =
          provider === "tavily"
            ? await searchTavily(query, maxResults)
            : provider === "brave"
              ? await searchBrave(query, maxResults)
              : await searchSerper(query, maxResults);

        return { ok: true, data: payload };
      } catch (e) {
        return {
          ok: false,
          error_code: "upstream_failed",
          message: `Search provider failed: ${e instanceof Error ? e.message : "unknown error"}. Tell the user the search couldn't run right now; they can try again or paste a specific URL for you to read with web_fetch.`,
        };
      }
    },
  };
}

// ─── Providers ────────────────────────────────────────────────────────────

async function searchTavily(query: string, maxResults: number): Promise<WebSearchPayload> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: maxResults,
        include_answer: true,
        search_depth: "basic",
      }),
    });
    if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
    const json = (await res.json()) as {
      answer?: string;
      results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
    };
    return {
      query,
      provider: "tavily",
      answer: json.answer,
      results: (json.results ?? []).slice(0, maxResults).map((r) => ({
        title: (r.title ?? "").trim(),
        url: (r.url ?? "").trim(),
        snippet: truncate((r.content ?? "").trim(), 400),
        publishedAt: r.published_date,
      })),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function searchBrave(query: string, maxResults: number): Promise<WebSearchPayload> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": process.env.BRAVE_API_KEY!,
      },
    });
    if (!res.ok) throw new Error(`Brave HTTP ${res.status}`);
    const json = (await res.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> };
    };
    return {
      query,
      provider: "brave",
      results: (json.web?.results ?? []).slice(0, maxResults).map((r) => ({
        title: (r.title ?? "").trim(),
        url: (r.url ?? "").trim(),
        snippet: truncate(stripHtml(r.description ?? ""), 400),
        publishedAt: r.age,
      })),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function searchSerper(query: string, maxResults: number): Promise<WebSearchPayload> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.SERPER_API_KEY!,
      },
      body: JSON.stringify({ q: query, num: maxResults }),
    });
    if (!res.ok) throw new Error(`Serper HTTP ${res.status}`);
    const json = (await res.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
      answerBox?: { answer?: string; snippet?: string };
    };
    const answer = json.answerBox?.answer ?? json.answerBox?.snippet;
    return {
      query,
      provider: "serper",
      answer,
      results: (json.organic ?? []).slice(0, maxResults).map((r) => ({
        title: (r.title ?? "").trim(),
        url: (r.link ?? "").trim(),
        snippet: truncate((r.snippet ?? "").trim(), 400),
        publishedAt: r.date,
      })),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}
