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

  const brandLine = brandKit
    ? `Brand: ${brandKit.name}${brandKit.description ? ` (${brandKit.description})` : ""}. This design is FOR and ON BEHALF OF ${brandKit.name} only. The voice / signature on the design is "${brandKit.name}", "${brandKit.name} team", or simply the brand name — NOT any third-party platform, software, tool, marketing app, SaaS, or service that may have generated this design. Do NOT mention "FlowSmartly", "AI", "ChatGPT", "OpenAI", "Grok", or any other platform / vendor / engine name in the text. Speak as ${brandKit.name} to ${brandKit.name}'s customers.`
    : "";

  // Resolve occurrence year for CALENDAR_EVENT triggers so the AI knows the
  // correct year (avoids hallucinating "Ring in 2025" when we're in 2026).
  // Computed BEFORE headline scrubbing so the scrubber can replace stale years.
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
  const dateContext = occurrenceYear
    ? `Today's date: ${todayIso}. This occurrence is in the year ${occurrenceYear}.`
    : `Today's date: ${todayIso}.`;

  // Scrub any stale year mentions in the stored topic so we never carry
  // forward a "Ring in 2025" baked in from when the item was first filled.
  // Replaces any 19xx / 20xx with the correct occurrence year (or removes
  // the year + surrounding "Ring in / Welcome / Hello" phrasing if we
  // don't have an occurrence year).
  const rawHeadline =
    automation.topic ||
    automation.calendarSourceLabel ||
    automation.name ||
    null;
  const headline = rawHeadline
    ? (() => {
        const correctYear = occurrenceYear ? String(occurrenceYear) : null;
        let h = rawHeadline;
        if (correctYear) {
          h = h.replace(/\b(19|20)\d{2}\b/g, correctYear);
        } else {
          h = h.replace(/\b(?:Ring\s+in|Welcome\s+to|Hello)\s+(19|20)\d{2}\b/gi, "");
          h = h.replace(/\b(19|20)\d{2}\b/g, "").replace(/\s{2,}/g, " ").trim();
        }
        return h;
      })()
    : null;
  const headlineLine = headline
    ? `Headline / message to render legibly as part of the design (typography styled in brand colors): "${headline}".`
    : "";

  const styleLine =
    style === "3d"
      ? "Aesthetic: high-quality 3D-rendered scene — stylized CGI with rich materials, dramatic lighting, depth of field — wrapped in a clean modern social-media design layout."
      : "Aesthetic: photorealistic photograph as the hero subject — natural lighting, professional photography — wrapped in a clean modern social-media design layout.";

  // Layout variants with SMART per-layout logo placement.
  // - description: feeds the AI prompt
  // - reservedDesc: tells AI exactly which corner to keep quiet for the logo
  //   (the SAME corner where the compositor will land the logo)
  // - placement: x/y are 0-1 fractions of image dims pointing to the
  //   TOP-LEFT of the logo bounding box; sizePercent is logo width as % of
  //   image width
  // Seeded by item id so re-runs on the same item pick the same variant.
  interface LayoutVariant {
    description: string;
    reservedDesc: string;
    placement: { x: number; y: number; sizePercent: number };
  }
  const LAYOUT_VARIANTS: LayoutVariant[] = [
    {
      description:
        "Layout: editorial split — the bold serif headline sits on the LEFT half of the canvas over a brand-colored panel; a full-bleed hero photo fills the RIGHT half. A thin brand-accent vertical stripe separates them.",
      reservedDesc:
        "Logo will be placed BOTTOM-LEFT (over the brand-colored left panel, below the headline). Leave a ~30% width × 18% height quiet area in the BOTTOM-LEFT of the left panel — no text, no decorative element there.",
      placement: { x: 0.03, y: 0.78, sizePercent: 22 },
    },
    {
      description:
        "Layout: magazine cover — a single large hero photo fills most of the canvas. A wide brand-color band sits at the BOTTOM holding the headline in a heavy display sans-serif and the contact pills on a row below.",
      reservedDesc:
        "Logo will be placed TOP-LEFT on the photo. Leave a ~30% width × 18% height quiet area in the TOP-LEFT — keep that part of the photo low-detail (sky, blur, soft surface). Photographic subject of interest should sit center or right.",
      placement: { x: 0.03, y: 0.03, sizePercent: 22 },
    },
    {
      description:
        "Layout: stacked card — hero photo fills the upper 55% of the canvas with a soft brand-color gradient overlay; lower 45% is a solid brand-color block holding the headline in big bold typography and the contact pills as styled chips.",
      reservedDesc:
        "Logo will be placed TOP-LEFT on the photo upper half. Leave a ~30% width × 18% height quiet area in the TOP-LEFT — low-detail photo background there. The headline in the lower brand block can use the full bottom.",
      placement: { x: 0.03, y: 0.03, sizePercent: 22 },
    },
    {
      description:
        "Layout: diagonal accent — a large brand-color triangular wedge cuts diagonally across the upper-left of the canvas; the headline lives inside the wedge in white type; the rest of the canvas is the hero photo with the contact band at the bottom.",
      reservedDesc:
        "Logo will be placed TOP-LEFT inside the brand-color wedge. Place the headline BELOW the logo area within the wedge. Leave the very top-left ~24% width × 14% height of the wedge clear of headline text for the logo.",
      placement: { x: 0.03, y: 0.03, sizePercent: 20 },
    },
    {
      description:
        "Layout: modern poster — a bold typographic headline dominates the canvas (huge display type filling 40% of the height) over a soft brand-color gradient. A smaller photo sits as a tasteful inset or corner accent. Contact pills as a clean strip at the bottom.",
      reservedDesc:
        "Logo will be placed TOP-RIGHT. Leave a ~30% width × 18% height quiet area in the TOP-RIGHT corner. The huge headline can dominate the center / left but must NOT extend into the top-right.",
      placement: { x: 0.67, y: 0.03, sizePercent: 22 },
    },
    {
      description:
        "Layout: frame-in-frame — the hero photo is inset from the edges with a thick brand-color border around all four sides. The headline sits in the top border (white typography on brand-color); contact pills sit in the bottom border.",
      reservedDesc:
        "Logo will be placed in the LEFT side of the TOP border. Reserve ~28% width × 12% height on the LEFT END of the top border for the logo. The headline within the top border should be aligned RIGHT or centered after that left logo area.",
      placement: { x: 0.03, y: 0.02, sizePercent: 22 },
    },
    {
      description:
        "Layout: ribbon strap — a brand-color ribbon strap cuts horizontally across the upper-third holding the headline in bold script or serif typography; the hero photo fills the rest of the canvas with a clean footer band at the bottom for contact pills.",
      reservedDesc:
        "Logo will be placed at the LEFT END of the ribbon strap. Reserve ~28% width × 14% height on the LEFT END of the ribbon for the logo. The headline on the ribbon should be aligned RIGHT or centered after that left logo area.",
      placement: { x: 0.03, y: 0.05, sizePercent: 22 },
    },
    {
      description:
        "Layout: gradient overlay — a single dramatic photo fills the entire canvas with a brand-color radial or diagonal gradient overlay. The headline sits in white display typography in the LOWER-LEFT. Contact pills as a translucent rounded card overlaid on the bottom-right.",
      reservedDesc:
        "Logo will be placed TOP-RIGHT. Reserve ~30% width × 18% height in the TOP-RIGHT corner — keep that part of the photo low-detail. The headline lives in the LOWER-LEFT, NOT the top.",
      placement: { x: 0.67, y: 0.03, sizePercent: 22 },
    },
  ];
  // Random layout pick per generation so re-generating the same item gives
  // visual variety. (Was stable per item id — too "same" when testing.)
  const chosenLayout =
    LAYOUT_VARIANTS[Math.floor(Math.random() * LAYOUT_VARIANTS.length)];
  const layoutLine = chosenLayout.description;
  const reservedLine = chosenLayout.reservedDesc;

  // Premium tier earns a stronger styling push — gpt-image-1 can produce
  // editorial-magazine-grade type when nudged.
  const premiumPolish =
    tier === "premium"
      ? "Premium quality bar: design should match the work of a senior brand designer at a top studio — confident type hierarchy, considered color contrast, real attention to spacing, photographic quality should feel art-directed, NOT generic stock. Treat this like an editorial magazine cover or a high-end brand campaign, not a basic social post template. Vary your composition — DO NOT default to a centered title + paragraph layout."
      : "";

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

  // OpenAI prompt: rules FIRST (gpt-image-1 weights leading instructions
  // more strongly), then the raw data. Three essential rules kept tight.
  // Contact items rendered as character-exact strings so the model doesn't
  // typo (e.g. "info@pflowsmartly.com" instead of "info@flowsmartly.com").
  const exactContacts = contactBits.length
    ? contactBits
        .map((c) => `"${c.replace(/^(\w+)\s+/, "$1: ")}"`)
        .join(", ")
    : "";

  const openaiPrompt = [
    // RULES FIRST — short, clear, non-negotiable.
    "STRICT — no logos. Do NOT draw, write, fabricate, sketch, or include any logo, brand mark, wordmark, monogram, leaf icon, app icon, abstract emblem, watermark, signature, or any visual element that resembles a brand identity mark. The image must NOT contain anything that looks like a logo. We composite the real brand logo on top of this image AFTER generation — leave a small visually-quiet area in the top corner for it.",
    "STRICT — no fabricated text. The headline, brand name, and contact items below are the ONLY text you may render. Do NOT invent slogans, taglines, body copy, dates, prices, percentages, statistics. Do NOT add, modify, mistype, or extend any contact item — render each one character-for-character exactly as I give it. Do NOT include any year on the image that I did not specify.",
    "STRICT — minimal on-image text. Render the headline as a hero header AND the contact items as small footer pills. That is ALL the text. No body paragraphs, no descriptions, no multi-sentence essays, no quote bubbles, no extra labels. The post's detailed caption lives separately and is NOT to be rendered on this image.",
    // DATA — clean structured fields.
    `Format: ${aspectLabel}. Aesthetic: ${style === "3d" ? "3D-rendered" : "photorealistic photograph"}. Tone: ${automation.aiTone || "friendly"}.`,
    `Subject of the post: ${subject}.`,
    headline ? `Headline text to render EXACTLY (no edits, no additions): "${headline}".` : "",
    brandKit
      ? `Brand identity: name "${brandKit.name}"${brandKit.description ? `, description "${brandKit.description}"` : ""}.`
      : "",
    brandColors.primary || brandColors.secondary || brandColors.accent
      ? `Brand colors to USE in the design (do NOT render the hex strings as text): primary ${brandColors.primary || "n/a"}, secondary ${brandColors.secondary || "n/a"}, accent ${brandColors.accent || "n/a"}.`
      : "",
    exactContacts ? `Contact items to render EXACTLY as footer pills (character-for-character, no typos, no extra letters): ${exactContacts}.` : "",
    occurrenceYear ? `If the design needs to mention a year, the ONLY allowed year is ${occurrenceYear}. Today's date: ${todayIso}.` : `Today's date: ${todayIso}.`,
    chosenLayout.description,
  ]
    .filter(Boolean)
    .join(" ");

  // xAI / Gemini need explicit guardrails — they fabricate logos, ignore
  // year context, write blog-length copy, etc. without them.
  const ruledPrompt = [
    `Design a complete, premium, scroll-stopping ${aspectLabel} social media post about: ${subject}.`,
    headlineLine,
    styleLine,
    layoutLine,
    premiumPolish,
    brandLine,
    colorLine,
    contactLine,
    dateContext,
    `Tone: ${automation.aiTone || "friendly"}.`,
    `Canvas rule: the image fills the entire ${dims.width}×${dims.height} (${aspectLabel}) frame edge-to-edge. The design IS the social post itself. Do NOT add an outer page border, surrounding canvas color, margin, drop-shadow frame, or background-around-a-card effect. The composition extends to all four edges of the image.`,
    "Copy length: this is a SOCIAL MEDIA post, NOT a blog post. Total visible text on the design must be SHORT and PRECISE — one headline (3-7 words max) PLUS at most one short sub-line (max 12 words). NO paragraphs. NO multi-sentence essays. NO body-copy blocks. If you write more than 2 short lines of text on the image, you have failed this brief.",
    "Render the headline as legible on-brand typography (a hero header). Render the contact pills in a footer band using brand colors. Use brand colors purposefully as accents, ribbons, separators, or backgrounds. The result should look like the work of a brand designer.",
    `Logo-overlay reservation (CRITICAL — read carefully): ${reservedLine} The HEADLINE and any other text MUST NOT extend into that reserved area. Do NOT draw a placeholder rectangle, blank box, outlined card, or any visible container in the reserved area — leave it as part of the natural design background.`,
    "Anti-fabrication: only render text I have explicitly given you (headline, brand name, contact items above, year context). Do NOT invent slogans that reference past years, future years, phone numbers, addresses, percentages, prices, statistics, customer counts, founding dates, or any factual claim about the brand that I did not provide. If you reference a year, use ONLY the occurrence year I specified — never any other year.",
    "STRICT PROHIBITION — do NOT draw, render, paint, write, or fabricate any LOGO, brand mark, monogram, company icon, app icon, swirl that resembles a logo, abstract emblem, watermark, signature, badge, or any visual element that looks like the brand's logo. Do NOT draw a placeholder rectangle / empty box / blank card / outlined shape / framed area in the reserved top-left corner — leave it as part of the natural background. Everything ELSE (typography, brand colors, contact info, headline, decorative shapes, photographic or 3D subject matter) is allowed and expected.",
  ]
    .filter(Boolean)
    .join(" ");

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
          // Smart backdrop: if the AI's bg color at the logo target area
          // matches the logo color, drop a subtle rounded translucent
          // backdrop so the logo stays visible. Only fills the logo's
          // bounding rect — never hides headline / contact pills.
          smartBackdrop: true,
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
