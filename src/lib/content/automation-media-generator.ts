import { prisma } from "@/lib/db/client";
import type { ImageProvider } from "@/lib/ai/design-image-pipeline";
import { generateBrandedImage } from "@/lib/media/branded-image";
import { getHolidayById, getHolidayDate } from "@/lib/marketing/holidays";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost, type CreditCostKey } from "@/lib/credits/costs";
import { recordAiMemory } from "@/lib/ai-memory";

export interface GenerateMediaOptions {
  userId: string;
  automationId: string;
  tier?: "premium" | "standard";
  style?: "realistic" | "3d";
  aspect?: "square" | "portrait" | "landscape";
  appliesTo?: string;
  /** Override occurrence year (used by scheduler for per-occurrence year context). */
  occurrenceYearOverride?: number | null;
  /** S3 key prefix tag — "campaigns" for manual, "scheduled" for scheduler fires. */
  keyTag?: string;
}

export interface GenerateMediaResult {
  url: string;
  provider: ImageProvider;
  tier: "premium" | "standard";
  style: "realistic" | "3d";
  aspect: "square" | "portrait" | "landscape";
  appliesTo: string;
  creditCost: number;
  creditsSpent: number;
  balanceAfter: number | null;
}

/**
 * Generate a branded media image for a single ContentAutomation occurrence.
 *
 * Used by:
 *  - The manual /api/.../generate-media route (pre-generation flow)
 *  - The campaign scheduler when mediaMode = AI_AT_POST_TIME (fresh per fire)
 *
 * Generation itself is delegated to the SHARED `generateBrandedImage` engine
 * (src/lib/media) — the same one Flow-AI's create_branded_design and the Studio
 * Create modal use — so automation posts match FlowCreative quality (full-bleed
 * brand layouts, real logo composite, correct current year). This function owns
 * only the automation-specific concerns: the credit gate/charge and the
 * per-occurrence year context. It passes `skipCredits` so the engine doesn't
 * double-charge.
 *
 * Does NOT touch the automation row's mediaUrl field — caller decides whether
 * to persist (manual flow does; scheduler doesn't).
 *
 * Throws on failure. Credits are deducted AFTER a successful generation so a
 * failed gen costs the user nothing.
 */
export async function generateAutomationMedia(
  opts: GenerateMediaOptions,
): Promise<GenerateMediaResult> {
  const tier: "premium" | "standard" = opts.tier === "premium" ? "premium" : "standard";
  const style: "realistic" | "3d" = opts.style === "3d" ? "3d" : "realistic";
  const aspect: "square" | "portrait" | "landscape" =
    opts.aspect === "portrait" || opts.aspect === "landscape" ? opts.aspect : "square";
  const appliesTo =
    typeof opts.appliesTo === "string" && /^(all|\d{4})$/.test(opts.appliesTo)
      ? opts.appliesTo
      : "all";
  const keyTag = opts.keyTag || "campaigns";

  // Credit gate BEFORE generation so a broke user doesn't burn provider $$.
  const costKey: CreditCostKey =
    tier === "premium" ? "AI_DESIGN_LAYOUT_IMAGE" : "AI_VISUAL_DESIGN";
  const creditCost = await getDynamicCreditCost(costKey);
  const balance = await creditService.getBalance(opts.userId);
  if (balance < creditCost) {
    const err = new Error(
      `Not enough credits — this generation needs ${creditCost} credits, you have ${balance}.`,
    ) as Error & { code?: string; required?: number; balance?: number };
    err.code = "INSUFFICIENT_CREDITS";
    err.required = creditCost;
    err.balance = balance;
    throw err;
  }

  const automation = await prisma.contentAutomation.findFirst({
    where: { id: opts.automationId, userId: opts.userId },
    select: {
      id: true,
      name: true,
      topic: true,
      aiPrompt: true,
      aiTone: true,
      calendarSourceType: true,
      calendarSourceId: true,
      calendarSourceLabel: true,
    },
  });
  if (!automation) throw new Error("Automation not found");

  const subject =
    automation.topic ||
    automation.aiPrompt ||
    automation.calendarSourceLabel ||
    automation.name;

  // Occurrence-year resolution. Caller can override (scheduler passes the year
  // of the specific occurrence being emitted). The engine injects today's date
  // automatically; we only add an explicit year hint when this occurrence is in
  // a different year than today (e.g. a holiday that already passed this year).
  let occurrenceYear: number | null = opts.occurrenceYearOverride ?? null;
  if (
    occurrenceYear === null &&
    automation.calendarSourceType === "HOLIDAY" &&
    automation.calendarSourceId
  ) {
    const h = getHolidayById(automation.calendarSourceId);
    if (h) {
      const thisYear = new Date().getFullYear();
      const dt = getHolidayDate(h, thisYear);
      const thisInstance = new Date(thisYear, dt.month - 1, dt.day).getTime();
      occurrenceYear = thisInstance >= Date.now() ? thisYear : thisYear + 1;
    }
  }

  // Build the creative brief for the shared engine (it applies the brand kit,
  // colors, logo, and contact details itself — we only pass the message/intent).
  const briefParts: string[] = [subject];
  if (automation.aiTone) briefParts.push(`Tone: ${automation.aiTone}.`);
  if (occurrenceYear && occurrenceYear !== new Date().getFullYear()) {
    briefParts.push(`This is for the ${occurrenceYear} occurrence — use ${occurrenceYear} for any year shown.`);
  }
  const brief = briefParts.join(" ");

  const design = await generateBrandedImage({
    userId: opts.userId,
    prompt: brief,
    orientation: aspect,
    tier,
    style: style === "3d" ? "3d" : "modern",
    // This function runs its OWN credit gate + deduction below; tell the engine
    // not to charge again.
    skipCredits: true,
  });
  if (!design.ok || !design.imageUrl) {
    throw new Error(design.error || "Image generation failed");
  }
  const url = design.imageUrl;

  // Charge AFTER successful generation.
  let balanceAfter: number | null = null;
  try {
    const deduction = await creditService.deductCredits({
      userId: opts.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditCost,
      description: `${keyTag === "campaigns" ? "Pre-generate" : "Auto-generate"} media (${tier})`,
      referenceType: "ContentAutomation",
      referenceId: opts.automationId,
      metadata: { tier, style, appliesTo, costKey, keyTag },
    });
    balanceAfter = deduction.transaction?.balanceAfter ?? null;
    await prisma.contentAutomation.update({
      where: { id: opts.automationId },
      data: { totalCreditsSpent: { increment: creditCost } },
    });
  } catch (creditErr) {
    console.error("[automation-media] credit deduction failed:", creditErr);
  }

  // Provider is chosen by the engine's role policy (Standard → Nano Banana,
  // Premium → OpenAI); record the tier default for bookkeeping/metadata.
  const provider: ImageProvider = tier === "premium" ? "openai" : "gemini";

  console.log(
    `[automation-media] tier=${tier} appliesTo=${appliesTo} keyTag=${keyTag} cost=${creditCost} balanceAfter=${balanceAfter}`,
  );

  // Record into searchable AI memory (fire-and-forget).
  recordAiMemory({
    userId: opts.userId,
    kind: "media-generation",
    summary: `Image for "${subject.slice(0, 80)}" (${tier} ${style} ${aspect})`,
    content: { subject, tier, style, aspect, appliesTo, provider, creditCost, brief },
    mediaUrl: url,
    mediaType: "image",
    referenceType: "ContentAutomation",
    referenceId: opts.automationId,
  });

  return {
    url,
    provider,
    tier,
    style,
    aspect,
    appliesTo,
    creditCost,
    creditsSpent: creditCost,
    balanceAfter,
  };
}
