import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { generateImageWithProvider } from "@/lib/ai/image-router";
import type { ImageProvider } from "@/lib/ai/design-image-pipeline";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { getHolidayById, getHolidayDate } from "@/lib/marketing/holidays";
import { compositeBrandLogoOnImageBuffer } from "@/lib/media/brand-logo-compositor";
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
  };
  const tier: "premium" | "standard" =
    body.tier === "premium" ? "premium" : "standard";
  const appliesTo =
    typeof body.appliesTo === "string" && /^(all|\d{4})$/.test(body.appliesTo)
      ? body.appliesTo
      : "all";
  const style: "realistic" | "3d" = body.style === "3d" ? "3d" : "realistic";

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

  const headline =
    automation.topic ||
    automation.calendarSourceLabel ||
    automation.name ||
    null;
  const headlineLine = headline
    ? `Headline / message to render legibly as part of the design (typography styled in brand colors): "${headline}".`
    : "";

  const styleLine =
    style === "3d"
      ? "Aesthetic: high-quality 3D-rendered scene — stylized CGI with rich materials, dramatic lighting, depth of field — wrapped in a clean modern social-media design layout."
      : "Aesthetic: photorealistic photograph as the hero subject — natural lighting, professional photography — wrapped in a clean modern social-media design layout.";

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
  const dateContext = occurrenceYear
    ? `Today's date: ${todayIso}. This occurrence is in the year ${occurrenceYear}.`
    : `Today's date: ${todayIso}.`;

  // The AI designs the ENTIRE branded social media post — text, headline,
  // brand-colored accents, contact info, layout. The only thing it must NOT
  // draw is the actual brand logo (we composite the real one on top after).
  const prompt = [
    `Design a complete, premium, scroll-stopping 1:1 social media post about: ${subject}.`,
    headlineLine,
    styleLine,
    brandLine,
    colorLine,
    contactLine,
    dateContext,
    `Tone: ${automation.aiTone || "friendly"}.`,
    // Canvas rule — the image IS the post, no surrounding frame.
    "Canvas rule: the image fills the entire 1024×1024 frame edge-to-edge. The design IS the social post itself. Do NOT add an outer page border, surrounding canvas color, margin, drop-shadow frame, or background-around-a-card effect. The composition extends to all four edges of the image.",
    // Copy length — keep it social-post-tight, not a blog post.
    "Copy length: this is a SOCIAL MEDIA post, NOT a blog post. Total visible text on the design must be SHORT and PRECISE — one headline (3-7 words max) PLUS at most one short sub-line (max 12 words). NO paragraphs. NO multi-sentence essays. NO body-copy blocks. If you write more than 2 short lines of text on the image, you have failed this brief.",
    "Render the headline as legible on-brand typography (a hero header). Render the contact pills in a footer band using brand colors. Use brand colors purposefully as accents, ribbons, separators, or backgrounds. The result should look like the work of a brand designer.",
    // Safe corner for the logo composite — make it explicit and hard to ignore.
    "Logo-overlay reservation (CRITICAL): a brand logo will be composited on top of this image at the TOP-LEFT corner, taking up roughly the top-left 30% of the width × 18% of the height. You MUST keep that specific top-left region visually quiet — solid brand color, soft gradient, photo blur, or low-detail surface. The HEADLINE and any other text MUST NOT extend into that top-left region. If your headline is left-aligned, start it at least 32% across from the left edge — never from the very left. Do NOT draw a placeholder rectangle / blank box / outlined card in that area — leave it as part of the natural design background.",
    // Anti-fabrication rule for dates / years / facts.
    "Anti-fabrication: only render text I have explicitly given you (headline, brand name, contact items above, year context). Do NOT invent slogans that reference past years, future years, phone numbers, addresses, percentages, prices, statistics, customer counts, founding dates, or any factual claim about the brand that I did not provide. If you reference a year, use ONLY the occurrence year I specified — never any other year.",
    "STRICT PROHIBITION — do NOT draw, render, paint, write, or fabricate any LOGO, brand mark, monogram, company icon, app icon, swirl that resembles a logo, abstract emblem, watermark, signature, badge, or any visual element that looks like the brand's logo. Do NOT draw a placeholder rectangle / empty box / blank card / outlined shape / framed area in the reserved top-left corner — leave it as part of the natural background. Everything ELSE (typography, brand colors, contact info, headline, decorative shapes, photographic or 3D subject matter) is allowed and expected.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const { buffer: aiBuffer, provider } = await tryGenerate(
      prompt,
      1024,
      1024,
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
          // Bump default size so full wordmark logos read clearly. The
          // underlying compositor clamps to 8–28% of image width and
          // auto-shrinks the height to preserve aspect ratio.
          placement: { sizePercent: 22 },
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
    };

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
      `[generate-media] tier=${tier} provider=${provider} appliesTo=${appliesTo}`,
    );

    return NextResponse.json({
      success: true,
      data: { automation: updated, url, tier },
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
