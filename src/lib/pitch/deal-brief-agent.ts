import { HAIKU_MODEL, ai } from "@/lib/ai/client";
import type { ProposalPreset } from "./proposal-agent";

export type DealBriefMode = "proposal" | "pitch";

export interface DealBriefDraft {
  targetName?: string;
  targetWebsite?: string;
  recipientName?: string;
  recipientEmail?: string;
  preset?: ProposalPreset;
  serviceTitle?: string;
  serviceDescription?: string;
  goals?: string;
  price?: number;
  originalPrice?: number;
  billingInterval?: string;
  terms?: string;
}

const PRESETS = new Set<ProposalPreset>(["google-business-profile", "website-redesign", "local-seo", "custom"]);

function clean(value: unknown, max = 1200): string | undefined {
  const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  return text || undefined;
}

function money(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.round(value);
  const match = String(value || "").match(/\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);
  if (!match) return undefined;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : undefined;
}

function fallbackFromBrief(brief: string): DealBriefDraft {
  const url = brief.match(/https?:\/\/[^\s,]+|(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s,]*)?/i)?.[0];
  const email = brief.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const price = money(brief);
  const lower = brief.toLowerCase();
  const preset: ProposalPreset = lower.includes("google") || lower.includes("gbp")
    ? "google-business-profile"
    : lower.includes("website")
      ? "website-redesign"
      : lower.includes("seo")
        ? "local-seo"
        : "custom";
  const forMatch = brief.match(/\b(?:for|to)\s+([A-Z][A-Za-z0-9&'. -]{2,80})(?:[,.;\n]|$)/);
  return {
    targetName: clean(forMatch?.[1], 120),
    targetWebsite: clean(url, 240),
    recipientEmail: clean(email, 160),
    preset,
    price,
    serviceDescription: clean(brief, 1800),
  };
}

export async function parseDealBrief(input: { mode: DealBriefMode; brief: string }): Promise<DealBriefDraft> {
  const brief = clean(input.brief, 4000);
  if (!brief) return {};

  const fallback = fallbackFromBrief(brief);
  try {
    const text = await ai.generate(
      `Extract the user request into JSON only.

Mode: ${input.mode}
Brief:
${brief}

Return this exact JSON shape with null for unknown values:
{
  "targetName": "client or business name",
  "targetWebsite": "website URL if present",
  "recipientName": "person name if present",
  "recipientEmail": "email if present",
  "preset": "google-business-profile | website-redesign | local-seo | custom",
  "serviceTitle": "service/package title",
  "serviceDescription": "what the user is offering or wants the AI to sell",
  "goals": "desired outcome",
  "price": 199,
  "originalPrice": 399,
  "billingInterval": "month | project | year",
  "terms": "terms, cancellation, contract, timing, or payment notes"
}

Rules:
- Infer the best preset from the service.
- For pitch mode, targetName is the business to research and service fields can describe the outreach angle.
- Do not invent a website, email, or person name.
- If a field is not in the brief and cannot be inferred, return null.`,
      {
        model: HAIKU_MODEL,
        maxTokens: 1600,
        systemPrompt: "You convert messy business instructions into clean JSON for an automated proposal and pitch system. Return JSON only.",
      },
    );

    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) as Record<string, unknown> : {};
    const presetRaw = clean(parsed.preset, 80) as ProposalPreset | undefined;
    return {
      ...fallback,
      targetName: clean(parsed.targetName, 160) || fallback.targetName,
      targetWebsite: clean(parsed.targetWebsite, 260) || fallback.targetWebsite,
      recipientName: clean(parsed.recipientName, 120),
      recipientEmail: clean(parsed.recipientEmail, 180) || fallback.recipientEmail,
      preset: presetRaw && PRESETS.has(presetRaw) ? presetRaw : fallback.preset,
      serviceTitle: clean(parsed.serviceTitle, 180),
      serviceDescription: clean(parsed.serviceDescription, 2200) || fallback.serviceDescription,
      goals: clean(parsed.goals, 1200),
      price: money(parsed.price) ?? fallback.price,
      originalPrice: money(parsed.originalPrice),
      billingInterval: clean(parsed.billingInterval, 80),
      terms: clean(parsed.terms, 1600),
    };
  } catch (error) {
    console.warn("[deal-brief-agent] Falling back to local extraction:", error);
    return fallback;
  }
}
