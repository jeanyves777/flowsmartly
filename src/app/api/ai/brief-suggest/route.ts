import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { HAIKU_MODEL, ai } from "@/lib/ai/client";

/**
 * POST /api/ai/brief-suggest — the "Suggest ideas" AI helper behind the brief
 * modals. Reads the user's Brand Kit and proposes 2-3 ready-to-use briefs so the
 * user picks one and the form fills itself. kind: "campaign" (content-campaign
 * ideas) | "leads" (ideal-customer lead-search briefs). Returns { proposals }.
 * Cheap Haiku call — a free assist that drives the paid generate/find actions.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const kind: BriefKind = body?.kind === "leads" ? "leads" : body?.kind === "proposal" ? "proposal" : body?.kind === "film" ? "film" : "campaign";
    const extra = typeof body?.context === "string" ? body.context.slice(0, 400) : "";

    const brand = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { name: true, industry: true, niche: true, description: true, targetAudience: true, uniqueValue: true, voiceTone: true, products: true },
    });
    if (!brand?.name) {
      return NextResponse.json({ success: false, error: { message: "Set up your Brand Kit first so the agent can tailor ideas to your brand." } }, { status: 400 });
    }

    const products = (() => { try { const p = JSON.parse(brand.products || "[]"); return Array.isArray(p) ? p.filter((x) => typeof x === "string").slice(0, 8) : []; } catch { return []; } })();
    const brandLine = [
      `Brand: ${brand.name}.`,
      brand.industry || brand.niche ? `Industry/niche: ${[brand.industry, brand.niche].filter(Boolean).join(" / ")}.` : "",
      brand.description ? `About: ${brand.description.slice(0, 300)}.` : "",
      brand.targetAudience ? `Audience: ${brand.targetAudience}.` : "",
      brand.uniqueValue ? `Unique value: ${brand.uniqueValue}.` : "",
      brand.voiceTone ? `Voice: ${brand.voiceTone}.` : "",
      products.length ? `Offers: ${products.join(", ")}.` : "",
      extra ? `Extra context: ${extra}.` : "",
    ].filter(Boolean).join("\n");

    const prompt =
      kind === "film"
        ? `${brandLine}\n\nPropose exactly 3 DISTINCT short-FILM ideas for this brand — each a REAL, emotional STORY with a character and an arc (a mini-movie / cinematic ad-film), NOT a product pitch or explainer. The story must stand on its own and be genuinely engaging; the brand is NOT mentioned until the very END, where "${brand.name}" lands naturally as the resolution/payoff (a subtle closing reveal that recontextualizes the story). For each return: title (the film's name, 2-5 words), summary (one line — the emotional hook), brief (a vivid 3-4 sentence FILM BRIEF: the protagonist and what they want, the setting/journey, the emotional turn, and the closing beat where ${brand.name} appears as the payoff — cinematic, specific, human, no ad-speak).\nReturn ONLY a JSON array, no markdown: [{"title":"","summary":"","brief":""}]`
      : kind === "leads"
        ? `${brandLine}\n\nPropose exactly 3 DISTINCT ideal-customer lead-search briefs — WHO this brand should prospect to sell what it offers. For each brief return: title (3-6 words), summary (one sentence on why this segment is a strong fit), industry (the TARGET's industry, not this brand's), jobTitle (the decision-maker to reach), seniority (array, choose from: Owner, C-level, VP, Director, Manager), keywords (comma-separated buying signals).\nReturn ONLY a JSON array, no markdown: [{"title":"","summary":"","industry":"","jobTitle":"","seniority":[""],"keywords":""}]`
      : kind === "proposal"
        ? `${brandLine}\n\nPropose exactly 3 DISTINCT client-pitch briefs — WHO this brand should send a service proposal to and WHAT to offer them. For each return: title (3-6 words, the target client type), summary (one sentence on the fit), brief (one concrete sentence framed as "A proposal for [target] offering [our service], to [their goal]").\nReturn ONLY a JSON array, no markdown: [{"title":"","summary":"","brief":""}]`
        : `${brandLine}\n\nPropose exactly 3 DISTINCT content-campaign ideas this brand could run on social. For each return: title (3-6 words), summary (one sentence on why it works for this brand), name (a catchy campaign name), brief (one concrete sentence: the goal + angle), tone (one of: casual, professional, playful, bold).\nReturn ONLY a JSON array, no markdown: [{"title":"","summary":"","name":"","brief":"","tone":""}]`;

    const raw = await ai.generate(prompt, {
      model: HAIKU_MODEL,
      maxTokens: 700,
      temperature: 0.85,
      systemPrompt: "You are a sharp marketing strategist. You return concise, brand-specific, immediately usable ideas as STRICT JSON only — no prose, no markdown fences.",
    });

    const proposals = parseProposals(raw, kind);
    if (!proposals.length) {
      return NextResponse.json({ success: false, error: { message: "Couldn't come up with ideas — try again." } }, { status: 502 });
    }
    return NextResponse.json({ success: true, data: { proposals } });
  } catch (e) {
    console.error("[brief-suggest]", e);
    return NextResponse.json({ success: false, error: { message: "Suggestion failed" } }, { status: 500 });
  }
}

type BriefKind = "campaign" | "leads" | "proposal" | "film";

function parseProposals(raw: string, kind: BriefKind): Record<string, unknown>[] {
  let text = (raw || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  let arr: unknown;
  try { arr = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return arr.slice(0, 3).map((p) => {
    const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    if (kind === "leads") {
      return {
        title: str(o.title) || "Segment",
        summary: str(o.summary),
        industry: str(o.industry),
        jobTitle: str(o.jobTitle),
        seniority: Array.isArray(o.seniority) ? o.seniority.map(str).filter(Boolean).slice(0, 5) : [],
        keywords: str(o.keywords),
      };
    }
    if (kind === "proposal" || kind === "film") {
      return { title: str(o.title) || (kind === "film" ? "Untitled film" : "Proposal"), summary: str(o.summary), brief: str(o.brief) };
    }
    return {
      title: str(o.title) || "Campaign",
      summary: str(o.summary),
      name: str(o.name),
      brief: str(o.brief),
      tone: ["casual", "professional", "playful", "bold"].includes(str(o.tone).toLowerCase()) ? str(o.tone).toLowerCase() : "casual",
    };
  }).filter((p) => (kind === "leads" ? (p.industry || p.jobTitle) : (kind === "proposal" || kind === "film") ? p.brief : (p.name && p.brief)));
}
