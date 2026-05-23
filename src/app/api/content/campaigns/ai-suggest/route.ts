import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { ai } from "@/lib/ai/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";

type Field =
  | "campaign_name"
  | "campaign_description"
  | "item_name"
  | "item_topic"
  | "item_copy"
  | "item_hashtags"
  | "item_ai_prompt";

// Per-field credit cost key. Every AI suggest button charges — short-label
// fields cost less than paragraph fields. Resolved at request time via
// getDynamicCreditCost so admin pricing changes are picked up.
const COST_KEY_BY_FIELD: Record<Field, string> = {
  campaign_name: "AI_CAMPAIGN_NAME",        // 2
  campaign_description: "AI_CAPTION",        // 3
  item_name: "AI_CAMPAIGN_NAME",             // 2
  item_topic: "AI_CAPTION",                  // 3
  item_copy: "AI_CAPTION",                   // 3
  item_hashtags: "AI_HASHTAGS",              // 2
  item_ai_prompt: "AI_CAPTION",              // 3
};

const SYSTEM_PROMPT =
  "You are FlowSmartly's marketing copywriter. Write concise, on-brand suggestions in the user's tone. Output only the requested text — no preamble, no quotes, no markdown headings.";

interface FieldSpec {
  description: string;
  maxTokens: number;
  buildPrompt: (ctx: Context) => string;
}

interface Context {
  brandName: string;
  brandDescription: string;
  brandTone: string;
  campaignName?: string;
  campaignDescription?: string;
  itemName?: string;
  itemTopic?: string;
  platforms?: string[];
  hint?: string;
}

const FIELDS: Record<Field, FieldSpec> = {
  campaign_name: {
    description: "campaign name",
    maxTokens: 60,
    buildPrompt: (c) => `Suggest one short, catchy social media campaign name for ${c.brandName}${c.hint ? ` themed around: ${c.hint}` : ""}. 3-7 words max. No quotes.`,
  },
  campaign_description: {
    description: "campaign description",
    maxTokens: 200,
    buildPrompt: (c) => `Write a one-paragraph (40-60 words) description for the social media campaign "${c.campaignName ?? "this campaign"}" for ${c.brandName}.${c.hint ? ` Theme: ${c.hint}.` : ""} Brand: ${c.brandDescription || c.brandName}. Make it inspiring and action-oriented.`,
  },
  item_name: {
    description: "content item name",
    maxTokens: 60,
    buildPrompt: (c) => `Suggest one short content-item name for a social post inside the campaign "${c.campaignName ?? "the campaign"}"${c.hint ? ` about: ${c.hint}` : ""}. 3-6 words. No quotes.`,
  },
  item_topic: {
    description: "post topic",
    maxTokens: 200,
    buildPrompt: (c) => `Write a 2-3 sentence post topic brief for ${c.brandName}${c.itemName ? ` titled "${c.itemName}"` : ""}${c.hint ? ` about: ${c.hint}` : ""}. Brand: ${c.brandDescription || c.brandName}. Tone: ${c.brandTone}. Describe what the post should communicate.`,
  },
  item_copy: {
    description: "post caption",
    maxTokens: 400,
    buildPrompt: (c) => {
      const platformHint = c.platforms?.length ? ` Optimised for ${c.platforms.join(", ")}.` : "";
      return `Write a ready-to-post social caption for ${c.brandName}${c.itemTopic ? ` about: ${c.itemTopic}` : ""}${c.itemName ? ` (titled "${c.itemName}")` : ""}. Tone: ${c.brandTone}.${platformHint} Keep it under 220 characters, include a hook and a clear CTA. No hashtags in this output — those come separately. No quotes.`;
    },
  },
  item_hashtags: {
    description: "hashtags",
    maxTokens: 120,
    buildPrompt: (c) =>
      `Suggest 6-10 relevant hashtags for a social post${c.itemTopic ? ` about: ${c.itemTopic}` : ""} for ${c.brandName}. Output them as a comma-separated list without the # prefix. Mix branded, niche, and broad reach tags.`,
  },
  item_ai_prompt: {
    description: "AI generation prompt",
    maxTokens: 350,
    buildPrompt: (c) =>
      `Write a clear AI generation prompt that will be used to produce social post copy at posting time. Subject: ${c.itemTopic || c.itemName || c.hint || "the campaign theme"}. Brand: ${c.brandName} — ${c.brandDescription || ""}. Tone: ${c.brandTone}. The prompt should tell the AI what to write about, what to include (hook, value, CTA), and what to avoid. 3-5 sentences.`,
  },
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    field?: string;
    hint?: string;
    campaignId?: string;
    itemId?: string;
    overrides?: Partial<Context>;
  };

  const field = body.field as Field;
  if (!field || !(field in FIELDS)) {
    return NextResponse.json(
      { success: false, error: { message: "Unknown field" } },
      { status: 400 },
    );
  }

  // Credit gate BEFORE the AI call — every AI suggest button charges per
  // the hard rule. Deduction happens AFTER success so a failed call costs
  // nothing.
  const costKey = COST_KEY_BY_FIELD[field];
  const creditCost = await getDynamicCreditCost(costKey);
  const balance = await creditService.getBalance(session.userId);
  if (balance < creditCost) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INSUFFICIENT_CREDITS",
          message: `Not enough credits — this suggestion needs ${creditCost} credits, you have ${balance}.`,
          required: creditCost,
          balance,
        },
      },
      { status: 402 },
    );
  }

  // Load brand identity (defaults to first/default brand kit)
  let brandKit = await prisma.brandKit.findFirst({
    where: { userId: session.userId, isDefault: true },
  });
  if (!brandKit) {
    brandKit = await prisma.brandKit.findFirst({ where: { userId: session.userId } });
  }

  // Pull campaign / item context where available
  let campaignName: string | undefined;
  let campaignDescription: string | undefined;
  if (body.campaignId) {
    const c = await prisma.contentCampaign.findFirst({
      where: { id: body.campaignId, userId: session.userId },
      select: { name: true, description: true, defaultTone: true, defaultPlatforms: true },
    });
    if (c) {
      campaignName = c.name;
      campaignDescription = c.description ?? undefined;
    }
  }

  let itemName: string | undefined;
  let itemTopic: string | undefined;
  let platforms: string[] | undefined;
  if (body.itemId) {
    const a = await prisma.contentAutomation.findFirst({
      where: { id: body.itemId, userId: session.userId },
      select: { name: true, topic: true, platforms: true },
    });
    if (a) {
      itemName = a.name;
      itemTopic = a.topic ?? undefined;
      try {
        platforms = JSON.parse(a.platforms || "[]");
      } catch {
        platforms = undefined;
      }
    }
  }

  const ctx: Context = {
    brandName: brandKit?.name || "FlowSmartly",
    brandDescription: brandKit?.description || "",
    brandTone: brandKit?.voiceTone || "friendly",
    campaignName: body.overrides?.campaignName ?? campaignName,
    campaignDescription: body.overrides?.campaignDescription ?? campaignDescription,
    itemName: body.overrides?.itemName ?? itemName,
    itemTopic: body.overrides?.itemTopic ?? itemTopic,
    platforms: body.overrides?.platforms ?? platforms,
    hint: body.hint?.trim() || undefined,
  };

  const spec = FIELDS[field];
  try {
    const raw = await ai.generate(spec.buildPrompt(ctx), {
      maxTokens: spec.maxTokens,
      temperature: 0.8,
      systemPrompt: SYSTEM_PROMPT,
    });
    const cleaned = raw
      .replace(/^["'`\s]+|["'`\s]+$/g, "")
      .replace(/^[#*\->\s]+/gm, "")
      .trim();

    // Charge AFTER success.
    let balanceAfter: number | null = null;
    try {
      const deduction = await creditService.deductCredits({
        userId: session.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: creditCost,
        description: `AI suggest (${field})`,
        referenceType: "ContentCampaign",
        referenceId: body.campaignId ?? body.itemId ?? null,
        metadata: { field, costKey },
      });
      balanceAfter = deduction.transaction?.balanceAfter ?? null;
    } catch (creditErr) {
      console.error("[campaign ai-suggest] credit deduction failed:", creditErr);
    }

    return NextResponse.json({
      success: true,
      data: { value: cleaned, field, creditsSpent: creditCost, balanceAfter },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: err instanceof Error ? err.message : "AI suggestion failed",
        },
      },
      { status: 500 },
    );
  }
}
