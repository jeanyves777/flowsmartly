import { ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import type { AgentTool } from "./client";

/**
 * Business Plan agent — generates a 13-section business plan with
 * interactive charts, grounded in the user's live BrandKit.
 *
 * Tools:
 *  - get_brand_identity: full BrandKit snapshot (name, industry, audience,
 *    voice, colors, fonts, tagline, description, unique value, products).
 *    Agent MUST call this first — plan is brand-anchored.
 *  - get_industry_benchmarks: rough market-size + growth priors for common
 *    industries. Not authoritative; helps the agent produce believable
 *    numbers and chart data without hallucinating precise figures.
 *
 * Returns structured sections the viewer page renders as HTML plus
 * Recharts visualizations.
 */

export interface BusinessPlanInput {
  userId: string;
  /** Short user-facing name for the plan ("My SaaS Startup 2026"). */
  name: string;
  industry: string;
  stage: "idea" | "startup" | "growth" | "established";
  goals: string;
  targetAudience: string;
  /** USD — optional, drives the funding section. */
  fundingNeeded?: number;
  /** Only set when this is a regenerate call. */
  refinementPrompt?: string;
}

export interface BusinessPlanChart {
  type: "bar" | "line" | "pie";
  title: string;
  /** Y-axis label (e.g. "USD", "Customers"). Optional. */
  yLabel?: string;
  /** Data points. For bar/line: [{name, value}]. For pie: [{name, value}]. */
  data: Array<{ name: string; value: number; value2?: number; value2Name?: string }>;
}

export interface BusinessPlanSection {
  id: string;
  /** Human-visible section title. */
  title: string;
  /** Stable slug used by the viewer's table-of-contents navigation. */
  slug: string;
  /**
   * Rich HTML body. Only these tags are allowed (sanitized on read):
   * h2, h3, p, ul, ol, li, strong, em, blockquote, table, thead, tbody, tr, th, td, br.
   */
  body: string;
  /** Optional visualizations rendered after the body. */
  charts?: BusinessPlanChart[];
  /** One-liner used for cover + TOC. */
  summary?: string;
}

export interface BusinessPlanResult {
  sections: BusinessPlanSection[];
  brandSnapshot: Record<string, unknown>;
  usage: { inputTokens: number; outputTokens: number };
  iterations: number;
  toolsUsed: string[];
}

// Industry priors — ballpark figures to anchor the agent rather than have
// it invent exact market-size numbers. Not meant to be authoritative.
const INDUSTRY_BENCHMARKS: Record<
  string,
  { globalMarketUSD: string; cagr: string; topSegments: string[] }
> = {
  saas: { globalMarketUSD: "≈$250B (2026)", cagr: "13% CAGR", topSegments: ["CRM", "Collaboration", "Analytics", "Security"] },
  ecommerce: { globalMarketUSD: "≈$6.3T (2026)", cagr: "9% CAGR", topSegments: ["Fashion", "Electronics", "Home", "Health"] },
  fintech: { globalMarketUSD: "≈$320B (2026)", cagr: "17% CAGR", topSegments: ["Payments", "Lending", "WealthTech", "InsurTech"] },
  healthtech: { globalMarketUSD: "≈$640B (2026)", cagr: "18% CAGR", topSegments: ["Telehealth", "Devices", "Records", "Wellness"] },
  edtech: { globalMarketUSD: "≈$400B (2026)", cagr: "14% CAGR", topSegments: ["K-12", "Higher Ed", "Corporate", "Tutoring"] },
  marketing: { globalMarketUSD: "≈$780B (2026)", cagr: "8% CAGR", topSegments: ["Digital Ads", "Content", "Social", "SEO"] },
  food: { globalMarketUSD: "≈$9T (2026)", cagr: "5% CAGR", topSegments: ["Restaurants", "CPG", "Delivery", "Specialty"] },
  fashion: { globalMarketUSD: "≈$1.9T (2026)", cagr: "4% CAGR", topSegments: ["Apparel", "Luxury", "Footwear", "Accessories"] },
  fitness: { globalMarketUSD: "≈$100B (2026)", cagr: "9% CAGR", topSegments: ["Gyms", "Apps", "Equipment", "Nutrition"] },
  real_estate: { globalMarketUSD: "≈$4.1T (2026)", cagr: "3% CAGR", topSegments: ["Residential", "Commercial", "PropTech", "Rentals"] },
  consulting: { globalMarketUSD: "≈$700B (2026)", cagr: "6% CAGR", topSegments: ["Management", "IT", "Strategy", "HR"] },
  media: { globalMarketUSD: "≈$2.8T (2026)", cagr: "7% CAGR", topSegments: ["Streaming", "Publishing", "Gaming", "Podcasts"] },
  other: { globalMarketUSD: "varies by vertical", cagr: "varies", topSegments: ["Varies by sub-segment"] },
};

function buildTools(ctx: { userId: string }): AgentTool[] {
  return [
    {
      name: "get_brand_identity",
      description:
        "Fetch the user's full BrandKit — name, tagline, description, industry, niche, target audience, voice tone, personality, colors, fonts, unique value, products, keywords, hashtags, social handles. ALWAYS call this FIRST before generating any plan content so every section reflects their actual brand. Returns { configured: false } if the user has not set up their brand yet — in that case do NOT proceed; return an error.",
      input_schema: { type: "object", properties: {} },
      handler: async () => {
        const kit = await prisma.brandKit.findFirst({
          where: { userId: ctx.userId },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        });
        if (!kit) return { configured: false };

        const parseJSON = <T,>(raw: string | null | undefined, fallback: T): T => {
          if (!raw) return fallback;
          try { return JSON.parse(raw) as T; } catch { return fallback; }
        };

        return {
          configured: true,
          isComplete: kit.isComplete,
          name: kit.name,
          tagline: kit.tagline,
          description: kit.description,
          industry: kit.industry,
          niche: kit.niche,
          targetAudience: kit.targetAudience,
          audienceAge: kit.audienceAge,
          audienceLocation: kit.audienceLocation,
          voiceTone: kit.voiceTone,
          personality: parseJSON<string[]>(kit.personality, []),
          keywords: parseJSON<string[]>(kit.keywords, []),
          colors: parseJSON<Record<string, string>>(kit.colors, {}),
          fonts: parseJSON<Record<string, string>>(kit.fonts, {}),
          products: parseJSON<Array<Record<string, unknown>>>(kit.products, []),
          hashtags: parseJSON<string[]>(kit.hashtags, []),
          uniqueValue: kit.uniqueValue,
          guidelines: kit.guidelines,
          website: kit.website,
          email: kit.email,
          phone: kit.phone,
          city: kit.city,
          state: kit.state,
          country: kit.country,
        };
      },
    },
    {
      name: "get_industry_benchmarks",
      description:
        "Get rough market-size and growth-rate priors for a given industry. Call this BEFORE writing the Market Analysis or Financial Projections sections so your numbers are anchored to realistic ballparks instead of fabricated. Input: industry (one of saas, ecommerce, fintech, healthtech, edtech, marketing, food, fashion, fitness, real_estate, consulting, media, other). Returns { globalMarketUSD, cagr, topSegments }. Use these as an order-of-magnitude anchor — NOT as authoritative figures.",
      input_schema: {
        type: "object",
        properties: {
          industry: {
            type: "string",
            description:
              "Industry key. Lowercase, underscore-separated. Use 'other' if none of the canonical keys fit.",
          },
        },
        required: ["industry"],
      },
      handler: async (input) => {
        const key = String(input.industry || "other").toLowerCase().replace(/\s+/g, "_");
        return INDUSTRY_BENCHMARKS[key] ?? INDUSTRY_BENCHMARKS.other;
      },
    },
  ];
}

function buildSystemPrompt(input: BusinessPlanInput): string {
  return `You are a senior business strategist generating a comprehensive, investor-grade business plan for a real founder.

TOOLS (call these BEFORE writing the plan):
1. get_brand_identity — pull the founder's live brand. If configured:false, STOP and return an error JSON: {"error": "BRAND_NOT_CONFIGURED"}.
2. get_industry_benchmarks — call once with the industry key to anchor market-size numbers and chart data.

PLAN LENGTH: 13 sections, each a self-contained narrative the founder can drop into a pitch deck.

SECTIONS (in this order, with these exact slugs):
1. executive-summary — high-level overview + the "ask"
2. company-overview — who we are, mission, legal/ops structure
3. problem-solution — the pain we solve and how
4. market-analysis — TAM/SAM/SOM, trends, segments (CHART: market size by segment)
5. competitive-landscape — direct + indirect competitors, our moat (CHART: positioning)
6. products-services — offering details, pricing tiers
7. marketing-sales — GTM, channels, customer acquisition (CHART: channel mix)
8. operations-plan — delivery, tech stack, suppliers, KPIs
9. team-management — roles, gaps, hiring plan
10. financial-projections — 3-year revenue/cost/profit forecast (CHART: 3-year P&L)
11. funding-request — amount, use of funds, runway, milestones
12. risk-analysis — top 5 risks + mitigations (CHART: risk heatmap as bar chart)
13. roadmap-next-steps — 12-month timeline with quarterly milestones (CHART: timeline)

OUTPUT FORMAT — your FINAL answer must be ONLY a JSON object, no prose around it, no markdown fences:
{
  "sections": [
    {
      "id": "s1",
      "slug": "executive-summary",
      "title": "Executive Summary",
      "summary": "One-sentence TL;DR that fits on a cover page.",
      "body": "<h2>Company</h2><p>...</p><ul><li>...</li></ul>",
      "charts": [
        {
          "type": "bar" | "line" | "pie",
          "title": "Market size by segment (USD M)",
          "yLabel": "USD (millions)",
          "data": [{"name": "Segment A", "value": 1200}, ...]
        }
      ]
    },
    ... 13 sections total ...
  ]
}

BODY HTML RULES:
- Allowed tags only: h2, h3, p, ul, ol, li, strong, em, blockquote, table, thead, tbody, tr, th, td, br.
- No inline styles. No classes. No scripts. No images. No custom elements. No div.
- Start each body with an <h2> — the viewer renders the section title separately, so use <h2> for the FIRST sub-heading within the body (e.g. "Problem" / "Solution" / "Our approach").
- Use tables where appropriate (pricing tiers, competitor comparison, milestone timeline).
- Keep paragraphs tight — 2-4 sentences.

CHART RULES:
- Every chart needs a type, title, and data array.
- bar/line data: [{"name": "...", "value": number}].
- pie data: same shape — each entry is a slice.
- For 3-year P&L: use type "line", add value2 + value2Name to each point so we plot revenue AND expenses on the same chart.
- Only 6 sections MUST have charts: market-analysis, competitive-landscape, marketing-sales, financial-projections, risk-analysis, roadmap-next-steps. Other sections may omit "charts" entirely.
- Values must be realistic — use the industry benchmarks as an anchor, not random numbers.

VOICE & STYLE:
- Match the brand's voiceTone from get_brand_identity.
- Write in third person for the company ("FlowSmartly does X") unless the brand is a solo-founder personal brand.
- No filler, no clichés ("synergy", "disruptive revolution", etc.). Concrete, specific, numbers-backed.
- Reference the brand's unique value + products explicitly.

USER CONTEXT:
- Plan name: ${input.name}
- Industry: ${input.industry}
- Stage: ${input.stage}
- Goals: ${input.goals}
- Target audience: ${input.targetAudience}
${input.fundingNeeded ? `- Funding needed: $${input.fundingNeeded.toLocaleString()}` : "- Funding: not specified — write funding-request as a placeholder the founder can fill"}
${input.refinementPrompt ? `\nREFINEMENT REQUEST (this is a regeneration, user wants changes):\n${input.refinementPrompt}` : ""}`;
}

function buildUserMessage(input: BusinessPlanInput): string {
  return `Generate the 13-section business plan for "${input.name}".

Steps:
1. Call get_brand_identity — stop if not configured.
2. Call get_industry_benchmarks with the most relevant industry key.
3. Produce the JSON with all 13 sections in the specified order.

Return ONLY the JSON object. No preamble, no markdown fences.`;
}

export async function runBusinessPlanAgent(
  input: BusinessPlanInput,
): Promise<BusinessPlanResult> {
  const tools = buildTools({ userId: input.userId });

  const run = await ai.runWithTools<{ sections: BusinessPlanSection[] } | { error: string }>(
    buildUserMessage(input),
    tools,
    {
      systemPrompt: buildSystemPrompt(input),
      maxTokens: 16000,
      maxIterations: 8,
      // Adaptive thinking — Opus 4.7 runs deep when the task warrants it.
      thinkingBudget: 4000,
    },
  );

  if (!run.json) {
    throw new Error(
      `Business plan agent returned non-JSON output (${run.text.length} chars). First 200 chars: ${run.text.slice(0, 200)}`,
    );
  }

  if ("error" in run.json) {
    throw new Error(run.json.error);
  }

  const sections = run.json.sections;
  if (!Array.isArray(sections) || sections.length < 10) {
    throw new Error(`Business plan agent returned ${sections?.length ?? 0} sections — expected 13`);
  }

  // Normalize + sanitize — defensive, model sometimes adds stray fields
  const cleaned: BusinessPlanSection[] = sections.map((s, idx) => ({
    id: s.id || `s${idx + 1}`,
    slug: (s.slug || "").trim().toLowerCase() || `section-${idx + 1}`,
    title: s.title || `Section ${idx + 1}`,
    summary: s.summary,
    body: sanitizeBody(String(s.body || "")),
    charts: Array.isArray(s.charts) ? s.charts.filter(isValidChart) : undefined,
  }));

  // Pull the brand snapshot via a direct query so we store it even if the
  // agent only looked at it through a tool call.
  const kit = await prisma.brandKit.findFirst({
    where: { userId: input.userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  const brandSnapshot: Record<string, unknown> = kit
    ? {
        name: kit.name,
        tagline: kit.tagline,
        description: kit.description,
        industry: kit.industry,
        targetAudience: kit.targetAudience,
        voiceTone: kit.voiceTone,
        colors: safeJSON(kit.colors, {}),
        fonts: safeJSON(kit.fonts, {}),
        uniqueValue: kit.uniqueValue,
        website: kit.website,
      }
    : {};

  return {
    sections: cleaned,
    brandSnapshot,
    usage: run.usage,
    iterations: run.iterations,
    toolsUsed: run.toolsUsed,
  };
}

function safeJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

const ALLOWED_TAGS = new Set([
  "h2", "h3", "p", "ul", "ol", "li", "strong", "em", "blockquote",
  "table", "thead", "tbody", "tr", "th", "td", "br",
]);

/**
 * Strip any tag not in the allow-list. Also strips all attributes (inline
 * styles, classes, event handlers) — the viewer page supplies its own CSS.
 * Applied defensively before storing in the DB; the viewer also re-renders
 * via dangerouslySetInnerHTML with the same allow-list enforcement.
 */
function sanitizeBody(html: string): string {
  // Strip <script> and <style> blocks entirely (content + tags).
  let out = html.replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove any tag not on the allow-list; strip all attributes from kept tags.
  out = out.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (_match, tag, _attrs) => {
    const t = String(tag).toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return "";
    // Re-emit with no attrs
    const isClosing = _match.startsWith("</");
    return isClosing ? `</${t}>` : `<${t}>`;
  });
  return out.trim();
}

function isValidChart(c: unknown): c is BusinessPlanChart {
  if (!c || typeof c !== "object") return false;
  const x = c as Record<string, unknown>;
  const okType = x.type === "bar" || x.type === "line" || x.type === "pie";
  const okData = Array.isArray(x.data) && x.data.length > 0;
  return okType && okData && typeof x.title === "string";
}
