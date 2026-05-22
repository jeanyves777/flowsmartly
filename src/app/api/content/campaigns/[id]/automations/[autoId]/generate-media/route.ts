import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { generateImageWithProvider } from "@/lib/ai/image-router";
import type { ImageProvider } from "@/lib/ai/design-image-pipeline";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { getHolidayById, getHolidayDate } from "@/lib/marketing/holidays";
import { compositeBrandLogoOnImageBuffer } from "@/lib/media/brand-logo-compositor";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
interface Params {
  params: Promise<{ id: string; autoId: string }>;
}

function parseJsonSafe<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Tier → ordered provider list. Primary first, Google as universal fallback,
// then the other tier's primary as last resort. UI never sees these names.
function providerOrderForTier(tier: "premium" | "standard"): ImageProvider[] {
  if (tier === "premium") return ["openai", "gemini", "xai"];
  return ["xai", "gemini", "openai"];
}

async function tryGenerate(
  prompts: { openai: string; xai: string; gemini: string },
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
        prompts[provider],
        width,
        height,
        { quality: tier === "premium" ? "high" : "medium" },
      );
      if (!result.base64) throw new Error(`${provider} returned no image`);
      return { buffer: Buffer.from(result.base64, "base64"), provider };
    } catch (err) {
      lastError = err;
      console.warn(
        `[generate-media] ${provider} failed for tier=${tier}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  throw new Error(
    lastError instanceof Error ? lastError.message : "All providers failed",
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id: campaignId, autoId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    tier?: string;
    appliesTo?: string;
    style?: string;
    aspect?: string;
  };
  const tier: "premium" | "standard" =
    body.tier === "premium" ? "premium" : "standard";
  const appliesTo =
    typeof body.appliesTo === "string" && /^(all|\d{4})$/.test(body.appliesTo)
      ? body.appliesTo
      : "all";
  const style: "realistic" | "3d" = body.style === "3d" ? "3d" : "realistic";
  // Aspect ratio: "square" 1024×1024 (IG feed), "portrait" 1024×1536 (IG
  // story / Pinterest / longer copy), "landscape" 1536×1024 (Twitter / LI).
  const aspect: "square" | "portrait" | "landscape" =
    body.aspect === "portrait" || body.aspect === "landscape"
      ? body.aspect
      : "square";
  const dims =
    aspect === "portrait"
      ? { width: 1024, height: 1536 }
      : aspect === "landscape"
      ? { width: 1536, height: 1024 }
      : { width: 1024, height: 1024 };

  const automation = await prisma.contentAutomation.findFirst({
    where: { id: autoId, campaignId, userId: session.userId },
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
      firstPostCreatedAt: true,
    },
  });
  if (!automation) {
    return NextResponse.json(
      { success: false, error: { message: "Item not found" } },
      { status: 404 },
    );
  }
  if (automation.firstPostCreatedAt) {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Media is locked once posts have been scheduled" },
      },
      { status: 400 },
    );
  }

  // Credit gate — check before any AI call so we don't burn provider $$
  // generating media the user can't pay for. Standard uses the generic
  // visual-design cost; Premium uses the higher layout-image cost since
  // it routes to gpt-image-1 high quality.
  const costKey = tier === "premium" ? "AI_DESIGN_LAYOUT_IMAGE" : "AI_VISUAL_DESIGN";
  const creditCost = await getDynamicCreditCost(costKey);
  const balance = await creditService.getBalance(session.userId);
  if (balance < creditCost) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INSUFFICIENT_CREDITS",
          message: `Not enough credits — this generation needs ${creditCost} credits, you have ${balance}.`,
          required: creditCost,
          balance,
        },
      },
      { status: 402 },
    );
  }

  const aiConfig = parseJsonSafe<{ type?: string; style?: string }>(
    automation.aiMediaConfig,
    {},
  );

  // Load brand identity once — used for prompt context and logo composition.
  let brandKit = await prisma.brandKit.findFirst({
    where: { userId: session.userId, isDefault: true },
  });
  if (!brandKit) {
    brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
    });
  }

  const subject =
    automation.topic ||
    automation.aiPrompt ||
    automation.calendarSourceLabel ||
    automation.name;

  // Parse brand colors from BrandKit JSON
  type BrandColors = { primary?: string; secondary?: string; accent?: string };
  const brandColors = (() => {
    try {
      return JSON.parse(brandKit?.colors || "{}") as BrandColors;
    } catch {
      return {} as BrandColors;
    }
  })();
  const colorLine = brandKit && (brandColors.primary || brandColors.secondary || brandColors.accent)
    ? `Use these exact brand colors throughout the design as background tints, accent strips, ribbons, separators, decorative bars, and typography color — primary ${brandColors.primary || "(none)"}, secondary ${brandColors.secondary || "(none)"}, accent ${brandColors.accent || "(none)"}. Do NOT render the hex code strings as visible text in the image — apply the colors visually only.`
    : "";

  // Load active social handles for this user — feed them into the prompt so
  // the AI can render branded social pills (IG, FB, etc.) in the footer.
  const socialAccounts = await prisma.socialAccount.findMany({
    where: {
      userId: session.userId,
      isActive: true,
      platformUsername: { not: null },
    },
    select: { platform: true, platformUsername: true },
  });

  // Build a prioritized contact list and CAP at 3 items so the footer stays
  // clean. Order: website > email > phone > one social handle (the first
  // active one). The user explicitly limited this to 3 — overflow looks
  // cramped and the AI tries to fabricate when given too many slots.
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

  const contactLine = contactBits.length
    ? `Contact details to render in a DESIGNED footer band — each as its own styled pill / icon-badge / chip in brand color with a recognisable platform icon next to it (globe for website, envelope for email, phone receiver for phone, camera-aperture for instagram, F for facebook, X for twitter, in for linkedin, TT for tiktok, play-button for youtube, P for pinterest, @ for threads). Items to render — EXACTLY THESE ${contactBits.length}, no more, no fewer: ${contactBits.join("; ")}. The footer band uses brand-primary or brand-secondary color as background with the pills sitting on top in white or contrasting color. CRITICAL: do NOT invent, fabricate, hallucinate, or add ANY other phone number, email, URL, social handle, address, or contact field that I did not list above. If a field is missing from my list, OMIT it. Render ONLY the ${contactBits.length} items above, exactly as I gave them, character-for-character.`
    : "Do NOT render any contact info / contact footer / contact pills. The brand has no contact info to display — leave the bottom area for decorative brand-color accents only. Do NOT fabricate fake phone numbers, emails, URLs, or social handles.";

  // Resolve occurrence year for CALENDAR_EVENT triggers so the AI knows the
  // correct year (avoids hallucinating "Ring in 2025" when we're in 2026).
  let occurrenceYear: number | null = null;
  if (automation.calendarSourceType === "HOLIDAY" && automation.calendarSourceId) {
    const h = getHolidayById(automation.calendarSourceId);
    if (h) {
      const thisYear = new Date().getFullYear();
      const dt = getHolidayDate(h, thisYear);
      const thisInstance = new Date(thisYear, dt.month - 1, dt.day).getTime();
      occurrenceYear = thisInstance >= Date.now() ? thisYear : thisYear + 1;
    }
  }
  const todayIso = new Date().toISOString().slice(0, 10);

  // Logo placement variants — x/y are 0-1 fractions pointing to the TOP-LEFT
  // of the logo box; sizePercent is logo width as % of image width. Random
  // pick per generation so re-runs vary the corner.
  const LAYOUT_VARIANTS: Array<{ x: number; y: number; sizePercent: number }> = [
    { x: 0.03, y: 0.78, sizePercent: 22 }, // bottom-left
    { x: 0.03, y: 0.03, sizePercent: 22 }, // top-left
    { x: 0.67, y: 0.03, sizePercent: 22 }, // top-right
    { x: 0.03, y: 0.02, sizePercent: 22 }, // top-left tight
  ];
  const chosenLayout = {
    placement: LAYOUT_VARIANTS[Math.floor(Math.random() * LAYOUT_VARIANTS.length)],
  };

  // OpenAI works best with ALL raw data and ZERO rules — gpt-image-1 is
  // strong at composition / typography / brand fidelity when not constrained
  // by long prohibition clauses. xAI and Gemini need the rules to behave.
  // Build two prompt variants and feed each provider its preferred shape.

  const aspectLabel =
    aspect === "portrait"
      ? "portrait (4:5)"
      : aspect === "landscape"
      ? "landscape (16:9)"
      : "square (1:1)";

  // ONE short rule block, then raw data. No layout prescription. Same shape
  // for both OpenAI and xAI — let each engine design freely from the data.
  // Contact items passed as character-exact strings (so the model doesn't
  // typo) paired with an ICON HINT per type — model renders icon + value,
  // never a text label like "website:" / "email:".
  const iconFor = (typeWord: string): string => {
    const t = typeWord.toLowerCase();
    if (t === "website") return "globe icon";
    if (t === "email") return "envelope icon";
    if (t === "phone") return "phone-receiver icon";
    if (t === "instagram") return "Instagram camera glyph";
    if (t === "facebook") return "Facebook f glyph";
    if (t === "twitter" || t === "x") return "X glyph";
    if (t === "linkedin") return "LinkedIn in glyph";
    if (t === "tiktok") return "TikTok note glyph";
    if (t === "youtube") return "YouTube play glyph";
    if (t === "pinterest") return "Pinterest P glyph";
    if (t === "threads") return "Threads @ glyph";
    return `${typeWord} platform glyph`;
  };
  const exactContacts = contactBits.length
    ? contactBits
        .map((c) => {
          const m = c.match(/^(\w+)\s+(.+)$/);
          if (!m) return `"${c}"`;
          return `${iconFor(m[1])} + "${m[2]}"`;
        })
        .join("; ")
    : "";

  const ruleBlock =
    "RULES: (1) The design must FILL THE ENTIRE CANVAS edge-to-edge — full bleed. Do NOT add an outer frame, mat, border, page background, decorative wrap, picture-on-cloth effect, or any matting around the design. The design IS the whole image, not a smaller design placed on top of a colored background. (2) Do NOT draw the brand's logo / icon / brand mark anywhere on the design — the real brand logo is composited on top after generation. (3) Copy each contact value below character-for-character; do not alter, abbreviate, or fabricate phone numbers, emails, URLs, addresses, or social handles.";

  const dataBlock = [
    `Format: ${aspectLabel}. Aesthetic: ${style === "3d" ? "3D-rendered" : "photorealistic photograph"}. Tone: ${automation.aiTone || "friendly"}.`,
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

  const prompt = `Design a branded social media post. ${ruleBlock} ${dataBlock}`;
  const openaiPrompt = prompt;
  const ruledPrompt = prompt;

  try {
    const { buffer: aiBuffer, provider } = await tryGenerate(
      { openai: openaiPrompt, xai: ruledPrompt, gemini: ruledPrompt },
      dims.width,
      dims.height,
      tier,
    );

    // The AI does the entire branded design (text, colors, contact, layout).
    // We only composite the REAL brand FULL logo on top — that's the one
    // thing the AI can't reproduce. Prefer the full logo (wordmark + icon)
    // over the icon-only logo so the brand reads clearly; icon is only a
    // fallback when no full logo is set. Compositor auto-handles aspect and
    // scales the logo to a readable size that fits the reserved corner.
    let finalBuffer = aiBuffer;
    const logoSource = brandKit?.logo || brandKit?.iconLogo || null;
    if (logoSource) {
      try {
        finalBuffer = await compositeBrandLogoOnImageBuffer({
          imageBuffer: aiBuffer,
          logoSource,
          // Smart placement: the chosen layout variant dictates which corner
          // is "safe" (no text / subject sits there). Compositor preserves
          // aspect, so wordmarks and square icons both fit cleanly.
          placement: chosenLayout.placement,
          // No smart backdrop — the rectangle around the logo was obstructing
          // the design. Logo composites bare; legibility is handled by the
          // AI choosing a low-detail corner per the chosen layout's reserved
          // area + the prompt's "leave a quiet area" instruction.
          smartBackdrop: false,
        });
      } catch (compositeErr) {
        console.warn(
          "[generate-media] Logo composite failed; using bare AI image:",
          compositeErr instanceof Error ? compositeErr.message : compositeErr,
        );
      }
    }

    const key = `campaigns/${session.userId}/${autoId}-${Date.now()}.png`;
    const url = await uploadToS3(key, finalBuffer, "image/png");

    // Merge tier + appliesTo into aiMediaConfig so the scheduler can decide
    // per-occurrence whether to use this URL or regenerate at post time.
    const existingConfig = (() => {
      try {
        return JSON.parse(automation.aiMediaConfig ?? "{}") as Record<
          string,
          unknown
        >;
      } catch {
        return {} as Record<string, unknown>;
      }
    })();
    const mergedConfig = {
      ...existingConfig,
      type: existingConfig.type ?? "image",
      style,
      tier,
      appliesTo,
      aspect,
    };

    // Now that the image is in S3 and stamped on the automation, deduct
    // credits. Doing this AFTER success means a failed AI call or failed
    // upload never costs the user anything. Also tracked on the automation
    // row for usage analytics.
    let balanceAfter: number | null = null;
    try {
      const deduction = await creditService.deductCredits({
        userId: session.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: creditCost,
        description: `Pre-generate media (${tier})`,
        referenceType: "ContentAutomation",
        referenceId: autoId,
        metadata: { tier, style, appliesTo, provider, costKey },
      });
      balanceAfter = deduction.transaction?.balanceAfter ?? null;
      await prisma.contentAutomation.update({
        where: { id: autoId },
        data: { totalCreditsSpent: { increment: creditCost } },
      });
    } catch (creditErr) {
      console.error("[generate-media] credit deduction failed:", creditErr);
    }

    const updated = await prisma.contentAutomation.update({
      where: { id: autoId },
      data: {
        mediaUrl: url,
        mediaMode: "UPLOAD",
        aiMediaConfig: JSON.stringify(mergedConfig),
      },
      select: { id: true, mediaUrl: true, mediaMode: true },
    });

    // Log provider used server-side only — don't leak to client.
    console.log(
      `[generate-media] tier=${tier} provider=${provider} appliesTo=${appliesTo} cost=${creditCost} balanceAfter=${balanceAfter}`,
    );

    return NextResponse.json({
      success: true,
      data: {
        automation: updated,
        url,
        tier,
        creditsCharged: creditCost,
        balanceAfter,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            err instanceof Error ? err.message : "Image generation failed",
        },
      },
      { status: 500 },
    );
  }
}
