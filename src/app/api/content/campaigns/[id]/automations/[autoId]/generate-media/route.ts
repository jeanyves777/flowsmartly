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
  const colorLine = brandKit
    ? `Brand colors to incorporate purposefully in the design: primary ${brandColors.primary || "(unspecified)"}, secondary ${brandColors.secondary || "(unspecified)"}, accent ${brandColors.accent || "(unspecified)"}.`
    : "";

  const contactBits: string[] = [];
  if (brandKit?.website)
    contactBits.push(
      `Website: ${brandKit.website.replace(/^https?:\/\//, "").replace(/^www\./, "")}`,
    );
  if (brandKit?.email) contactBits.push(`Email: ${brandKit.email}`);
  if (brandKit?.phone) contactBits.push(`Phone: ${brandKit.phone}`);
  const contactLine = contactBits.length
    ? `Render the following contact info legibly in a clean footer or pill area: ${contactBits.join(" · ")}.`
    : "";

  const brandLine = brandKit
    ? `Brand: ${brandKit.name}${brandKit.description ? ` (${brandKit.description})` : ""}.`
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
    "Render the headline / message as legible on-brand typography integrated into the design (header strap, callout, or hero text). Render the contact info in a clean footer band, pill, or strip using the brand colors. Use the brand colors purposefully as accents, ribbons, separators, or backgrounds — not just thrown in. The result should look like a piece of work from a brand designer, not a plain photo.",
    "STRICT PROHIBITION — do NOT draw, render, paint, write, or fabricate any LOGO, brand mark, monogram, company icon, app icon, swirl that resembles a logo, abstract emblem, watermark, signature, or any visual element that looks like the BRAND'S logo. Do NOT draw a placeholder rectangle / empty box / blank card / outlined shape that suggests where a logo would go. The real logo will be composited on top of this image by a separate step — do not anticipate it. Everything ELSE (typography, brand colors, contact info, headline, decorative shapes, photographic or 3D subject matter) is allowed and expected.",
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
    // We only composite the REAL brand logo on top — that's the one thing the
    // AI can't reproduce. No template SVG, no contact pills, no extra layers.
    let finalBuffer = aiBuffer;
    const logoSource = brandKit?.iconLogo || brandKit?.logo || null;
    if (logoSource) {
      try {
        finalBuffer = await compositeBrandLogoOnImageBuffer({
          imageBuffer: aiBuffer,
          logoSource,
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
