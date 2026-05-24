import { prisma } from "@/lib/db/client";
import { generateImageWithProvider } from "@/lib/ai/image-router";
import type { ImageProvider } from "@/lib/ai/design-image-pipeline";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { getHolidayById, getHolidayDate } from "@/lib/marketing/holidays";
import { compositeBrandLogoOnImageBuffer } from "@/lib/media/brand-logo-compositor";
import { analyzeLogoPlacement } from "@/lib/media/analyze-logo-placement";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost, type CreditCostKey } from "@/lib/credits/costs";

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

function providerOrderForTier(tier: "premium" | "standard"): ImageProvider[] {
  if (tier === "premium") return ["openai", "gemini", "xai"];
  return ["xai", "gemini", "openai"];
}

async function tryGenerate(
  prompt: string,
  width: number,
  height: number,
  tier: "premium" | "standard",
): Promise<{ buffer: Buffer; provider: ImageProvider }> {
  const order = providerOrderForTier(tier);
  let lastError: unknown;
  for (const provider of order) {
    try {
      const result = await generateImageWithProvider(
        provider,
        prompt,
        width,
        height,
        { quality: tier === "premium" ? "high" : "medium" },
      );
      if (!result.base64) throw new Error(`${provider} returned no image`);
      return { buffer: Buffer.from(result.base64, "base64"), provider };
    } catch (err) {
      lastError = err;
      console.warn(
        `[automation-media] ${provider} failed for tier=${tier}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  throw new Error(
    lastError instanceof Error ? lastError.message : "All providers failed",
  );
}

const ICON_FOR: Record<string, string> = {
  website: "globe icon",
  email: "envelope icon",
  phone: "phone-receiver icon",
  instagram: "Instagram camera glyph",
  facebook: "Facebook f glyph",
  twitter: "X glyph",
  x: "X glyph",
  linkedin: "LinkedIn in glyph",
  tiktok: "TikTok note glyph",
  youtube: "YouTube play glyph",
  pinterest: "Pinterest P glyph",
  threads: "Threads @ glyph",
};

function safeParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Generate a branded media image for a single ContentAutomation occurrence.
 *
 * Used by:
 *  - The manual /api/.../generate-media route (pre-generation flow)
 *  - The scheduler when mediaMode = AI_AT_POST_TIME (fresh image per fire)
 *
 * Does NOT touch the automation row's mediaUrl field — caller decides whether
 * to persist (manual flow does; scheduler doesn't).
 *
 * Throws on failure. Credits are deducted AFTER successful S3 upload so a
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
  const dims =
    aspect === "portrait"
      ? { width: 1024, height: 1536 }
      : aspect === "landscape"
      ? { width: 1536, height: 1024 }
      : { width: 1024, height: 1024 };
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
      aiMediaConfig: true,
      calendarSourceType: true,
      calendarSourceId: true,
      calendarSourceLabel: true,
    },
  });
  if (!automation) throw new Error("Automation not found");

  let brandKit = await prisma.brandKit.findFirst({
    where: { userId: opts.userId, isDefault: true },
  });
  if (!brandKit) {
    brandKit = await prisma.brandKit.findFirst({ where: { userId: opts.userId } });
  }

  const socialAccounts = await prisma.socialAccount.findMany({
    where: { userId: opts.userId, isActive: true, platformUsername: { not: null } },
    select: { platform: true, platformUsername: true },
  });

  const subject =
    automation.topic ||
    automation.aiPrompt ||
    automation.calendarSourceLabel ||
    automation.name;

  type BrandColors = { primary?: string; secondary?: string; accent?: string };
  const brandColors = safeParse<BrandColors>(brandKit?.colors, {});

  // Contact items (cap at 3, character-exact).
  const allBits: string[] = [];
  if (brandKit?.website)
    allBits.push(
      `website ${brandKit.website.replace(/^https?:\/\//, "").replace(/^www\./, "")}`,
    );
  if (brandKit?.email) allBits.push(`email ${brandKit.email}`);
  if (brandKit?.phone) allBits.push(`phone ${brandKit.phone}`);
  for (const sa of socialAccounts) {
    const handle = sa.platformUsername!.startsWith("@")
      ? sa.platformUsername!
      : `@${sa.platformUsername}`;
    allBits.push(`${sa.platform} ${handle}`);
  }
  const contactBits = allBits.slice(0, 3);
  const exactContacts = contactBits.length
    ? contactBits
        .map((c) => {
          const m = c.match(/^(\w+)\s+(.+)$/);
          if (!m) return `"${c}"`;
          const icon = ICON_FOR[m[1].toLowerCase()] || `${m[1]} platform glyph`;
          return `${icon} + "${m[2]}"`;
        })
        .join("; ")
    : "";

  // Occurrence-year resolution. Caller can override (scheduler passes the
  // year of the specific occurrence being emitted).
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
  const todayIso = new Date().toISOString().slice(0, 10);

  const aspectLabel =
    aspect === "portrait"
      ? "portrait (4:5)"
      : aspect === "landscape"
      ? "landscape (16:9)"
      : "square (1:1)";

  const ruleBlock =
    "RULES: (1) Do NOT draw the brand's logo / icon / brand mark anywhere in the image — the real brand logo is composited on top after generation. (2) Copy each contact value below character-for-character; do not alter, abbreviate, or fabricate phone numbers, emails, URLs, addresses, or social handles.";

  const dataBlock = [
    `Aspect ratio: ${aspectLabel}. Style: ${style === "3d" ? "3D-rendered" : "photorealistic"}. Tone: ${automation.aiTone || "friendly"}.`,
    `Subject / event: ${subject}.`,
    brandKit?.description ? `Brand description: ${brandKit.description}.` : "",
    brandColors.primary || brandColors.secondary || brandColors.accent
      ? `Brand palette: primary ${brandColors.primary || "n/a"}, secondary ${brandColors.secondary || "n/a"}, accent ${brandColors.accent || "n/a"}.`
      : "",
    exactContacts ? `Contact items: ${exactContacts}.` : "",
    occurrenceYear ? `Year: ${occurrenceYear}. Today: ${todayIso}.` : `Today: ${todayIso}.`,
  ]
    .filter(Boolean)
    .join(" ");

  // Composition-leading opening — the no-mat instruction goes in the
  // OPENING (where models weight strongest) rather than buried mid-list
  // in a rule block. Same noun-rewrite the user previously approved:
  // don't say "design / post / poster" (object-priors). Describe it as
  // the scene itself filling the frame.
  const prompt = `Render a single ${aspectLabel} image filling the entire frame edge-to-edge. The full image canvas IS the visual content — there is no outer mat, frame, border, page background, or surface the image sits on. ${ruleBlock} ${dataBlock}`;

  const { buffer: aiBuffer, provider } = await tryGenerate(
    prompt,
    dims.width,
    dims.height,
    tier,
  );

  // Composite real brand logo on top (AI doesn't render logos faithfully).
  // Vision-analyze the generated image to pick the SAFEST corner for the
  // logo (one that doesn't overlap subject / faces / body text). Replaces
  // the previous random LAYOUT_VARIANTS picker, which gambled and often
  // landed the logo on top of headlines or paragraph copy.
  let finalBuffer = aiBuffer;
  const logoSource = brandKit?.logo || brandKit?.iconLogo || null;
  if (logoSource) {
    const placement = await analyzeLogoPlacement(aiBuffer);
    console.log(
      `[automation-media] logo placement: corner=${placement.corner} source=${placement.source}${placement.reason ? ` reason="${placement.reason}"` : ""}`,
    );
    try {
      finalBuffer = await compositeBrandLogoOnImageBuffer({
        imageBuffer: aiBuffer,
        logoSource,
        placement,
        smartBackdrop: false,
      });
    } catch (compositeErr) {
      console.warn(
        "[automation-media] Logo composite failed; using bare AI image:",
        compositeErr instanceof Error ? compositeErr.message : compositeErr,
      );
    }
  }

  const key = `${keyTag}/${opts.userId}/${opts.automationId}-${Date.now()}.png`;
  const url = await uploadToS3(key, finalBuffer, "image/png");

  // Charge AFTER successful upload.
  let balanceAfter: number | null = null;
  try {
    const deduction = await creditService.deductCredits({
      userId: opts.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditCost,
      description: `${keyTag === "campaigns" ? "Pre-generate" : "Auto-generate"} media (${tier})`,
      referenceType: "ContentAutomation",
      referenceId: opts.automationId,
      metadata: { tier, style, appliesTo, provider, costKey, keyTag },
    });
    balanceAfter = deduction.transaction?.balanceAfter ?? null;
    await prisma.contentAutomation.update({
      where: { id: opts.automationId },
      data: { totalCreditsSpent: { increment: creditCost } },
    });
  } catch (creditErr) {
    console.error("[automation-media] credit deduction failed:", creditErr);
  }

  console.log(
    `[automation-media] tier=${tier} provider=${provider} appliesTo=${appliesTo} keyTag=${keyTag} cost=${creditCost} balanceAfter=${balanceAfter}`,
  );

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
