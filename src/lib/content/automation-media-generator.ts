import { prisma } from "@/lib/db/client";
import { generateImageForRole } from "@/lib/ai/image-router";
import { imageGenerateRole } from "@/lib/ai/media-models";
import type { ImageProvider } from "@/lib/ai/design-image-pipeline";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { getHolidayById, getHolidayDate } from "@/lib/marketing/holidays";
import { compositeBrandLogoOnImageBuffer } from "@/lib/media/brand-logo-compositor";
import { analyzeLogoPlacement } from "@/lib/media/analyze-logo-placement";
import { nameBrandColors } from "@/lib/media/color-names";
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

async function tryGenerate(
  prompt: string,
  width: number,
  height: number,
  tier: "premium" | "standard",
): Promise<{ buffer: Buffer; provider: ImageProvider }> {
  // Route through the GLOBAL media-model policy: Standard → Nano Banana
  // (gemini-2.5-flash-image, the design/text engine) first; Premium → OpenAI
  // gpt-image. The router walks the chain, falls through on failure, and now
  // rejects blank/black frames (see image-quality-guard) so a dead generation
  // never reaches the logo compositor.
  const result = await generateImageForRole(
    imageGenerateRole(tier),
    prompt,
    width,
    height,
    { quality: tier === "premium" ? "high" : "medium" },
  );
  if (!result.base64) throw new Error("Image generation returned no image");
  // design_generate / premium chains never include the "flow" provider; map
  // defensively so the metadata type stays ImageProvider.
  const provider = (result.provider === "flow" ? "gemini" : result.provider) as ImageProvider;
  return { buffer: Buffer.from(result.base64, "base64"), provider };
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

  // Translate hex codes to natural color names so the prompt describes
  // the palette without exposing raw hex strings (which xAI tends to
  // render literally as visible text in the design). AI-driven naming
  // (Claude Haiku), cached per hex value across requests.
  const colorNames = await nameBrandColors({
    primary: brandColors.primary,
    secondary: brandColors.secondary,
    accent: brandColors.accent,
  });

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
    colorNames.primary || colorNames.secondary || colorNames.accent
      ? `Use these brand colors visually throughout the design as backgrounds, accents, and typography color: primary ${colorNames.primary || "neutral"}, secondary ${colorNames.secondary || "neutral"}, accent ${colorNames.accent || "neutral"}.`
      : "",
    exactContacts ? `Contact items: ${exactContacts}.` : "",
    occurrenceYear ? `Year: ${occurrenceYear}. Today: ${todayIso}.` : `Today: ${todayIso}.`,
  ]
    .filter(Boolean)
    .join(" ");

  // SUBJECT-FIRST opening. Image models weight the first few tokens
  // strongest AND respond better to POSITIVE framing (what TO depict)
  // than to negative framing (what NOT to depict). xAI in particular
  // tends to ignore "no people" instructions when they come after the
  // brand/event context — it pattern-matches "Labor Day / small
  // business" and adds people anyway. Lead with the allowed subject
  // list, repeat the human exclusion as both positive and negative,
  // then composition guarantees (no mat / no outer frame), then rules.
  const prompt = `An UNPOPULATED ${aspectLabel} image. The subject is exclusively: objects, environment / landscape, typography, abstract shapes, illustrations, icons, or symbolic imagery. The scene is empty of any humans — zero people, zero faces, zero portraits, zero figures, zero body parts visible anywhere. If you would normally include a person to convey the subject, replace them with their tools, products, workspace, environment, or a symbolic stand-in.

The image fills the entire frame edge-to-edge — no outer mat, no frame, no border, no page background, no surface the image sits on. The full canvas IS the visual content.

${ruleBlock}

${dataBlock}`;

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

  // Record into searchable AI memory (fire-and-forget).
  recordAiMemory({
    userId: opts.userId,
    kind: "media-generation",
    summary: `Image for "${subject.slice(0, 80)}" (${tier} ${style} ${aspect}, ${provider})`,
    content: { subject, tier, style, aspect, appliesTo, provider, creditCost, prompt },
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
