import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { HAIKU_MODEL, ai } from "@/lib/ai/client";
import { getUserPreferredLanguage, languageDirective } from "@/lib/ai/user-language";

type SuggestField =
  | "serviceTitle"
  | "serviceDescription"
  | "goals"
  | "terms"
  | "pitchBrief"
  | "proposalBrief";

const SUPPORTED: SuggestField[] = [
  "serviceTitle",
  "serviceDescription",
  "goals",
  "terms",
  "pitchBrief",
  "proposalBrief",
];

interface SuggestContext {
  targetName?: string;
  targetWebsite?: string;
  selectedServices?: string[];
  customAdditions?: string[];
  currentValue?: string;
  price?: number | string;
  billingInterval?: string;
}

function clean(value: unknown, max = 600): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function fieldPrompt(field: SuggestField, ctx: SuggestContext, brand: Record<string, unknown>): string {
  const brandLine = [
    brand.name ? `Brand: ${brand.name}` : "",
    brand.industry ? `Industry: ${brand.industry}` : "",
    brand.uniqueValue ? `Unique value: ${brand.uniqueValue}` : "",
    Array.isArray(brand.products) && brand.products.length ? `Services offered: ${(brand.products as unknown[]).slice(0, 8).join(", ")}` : "",
    brand.voiceTone ? `Voice: ${brand.voiceTone}` : "",
  ].filter(Boolean).join("\n");

  const ctxLine = [
    ctx.targetName ? `Prospect/client: ${ctx.targetName}` : "",
    ctx.targetWebsite ? `Prospect website: ${ctx.targetWebsite}` : "",
    ctx.selectedServices?.length ? `Services to include: ${ctx.selectedServices.join(", ")}` : "",
    ctx.customAdditions?.length ? `Custom additions: ${ctx.customAdditions.join("; ")}` : "",
    ctx.price ? `Price: $${ctx.price}${ctx.billingInterval ? `/${ctx.billingInterval}` : ""}` : "",
    ctx.currentValue ? `User's current draft to improve: ${ctx.currentValue}` : "",
  ].filter(Boolean).join("\n");

  const fieldInstructions: Record<SuggestField, string> = {
    serviceTitle:
      "Write a concise, clear service package name (3-8 words). It should describe what the user is selling to this prospect. No marketing fluff. No quotes around the answer.",
    serviceDescription:
      "Write 2-4 short sentences describing exactly what is included in this service for this prospect. Be specific and tangible. No bullet symbols. No section headers.",
    goals:
      "Write 1-2 sentences stating the outcome this engagement should produce for the prospect. Be concrete and measurable when possible.",
    terms:
      "Write 2-4 short plain-language terms: timing, payment, cancellation, deliverables ownership. No legalese, no contract language. One short sentence per term, separated by a single newline.",
    pitchBrief:
      "Write a 2-3 sentence brief telling the outreach agent which business to research and what angle to take, using the user's actual services. No greeting, no signature.",
    proposalBrief:
      "Write a 2-4 sentence brief telling the proposal agent who to write for and what to sell, using the user's actual services. Mention price/interval if provided. No greeting, no signature.",
  };

  return `You are filling in ONE field for a service-proposal/outreach builder. Return ONLY the field value as plain text (no JSON, no quotes, no preamble).

Field: ${field}
Instruction: ${fieldInstructions[field]}

About the sender:
${brandLine || "(brand details not available)"}

About this deal:
${ctxLine || "(no specific context provided)"}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const field = String(body.field || "") as SuggestField;
    if (!SUPPORTED.includes(field)) {
      return NextResponse.json(
        { success: false, error: { message: "Unsupported field" } },
        { status: 400 },
      );
    }

    const ctx: SuggestContext = {
      targetName: clean(body.context?.targetName, 180),
      targetWebsite: clean(body.context?.targetWebsite, 240),
      selectedServices: Array.isArray(body.context?.selectedServices)
        ? body.context.selectedServices.slice(0, 8).map((s: unknown) => clean(s, 120))
        : undefined,
      customAdditions: Array.isArray(body.context?.customAdditions)
        ? body.context.customAdditions.slice(0, 8).map((s: unknown) => clean(s, 180))
        : undefined,
      currentValue: clean(body.context?.currentValue, 1200),
      price: body.context?.price,
      billingInterval: clean(body.context?.billingInterval, 60),
    };

    const kit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: {
        name: true,
        industry: true,
        niche: true,
        uniqueValue: true,
        voiceTone: true,
        products: true,
        targetAudience: true,
      },
    });

    const brand: Record<string, unknown> = kit
      ? {
          name: kit.name,
          industry: kit.industry,
          niche: kit.niche,
          uniqueValue: kit.uniqueValue,
          voiceTone: kit.voiceTone,
          products: safeJSON<unknown[]>(kit.products, []),
          targetAudience: kit.targetAudience,
        }
      : {};

    const language = await getUserPreferredLanguage(session.userId);
    const text = await ai.generate(fieldPrompt(field, ctx, brand), {
      model: HAIKU_MODEL,
      maxTokens: 600,
      systemPrompt: `${languageDirective(language)}\n\nYou are a concise B2B copy assistant. Return plain text only. No quotes, no preamble, no JSON.`,
    });

    const value = clean(text.replace(/^["'`]+|["'`]+$/g, ""), 1800);
    if (!value) {
      return NextResponse.json(
        { success: false, error: { message: "Empty suggestion" } },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, data: { value } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI suggest failed";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
