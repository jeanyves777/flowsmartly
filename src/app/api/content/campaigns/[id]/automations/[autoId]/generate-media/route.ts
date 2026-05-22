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

  const brandLine = brandKit
    ? `Brand context for thematic reference only (do NOT depict this brand name visually): ${brandKit.name}${brandKit.description ? ` — ${brandKit.description}` : ""}.`
    : "";

  const styleLine =
    style === "3d"
      ? "Render style: high-quality 3D render — stylized CGI scene with rich materials, dramatic lighting, and depth of field. NOT a photograph."
      : "Render style: photorealistic photograph — real-world scene, natural lighting, professional photography aesthetic. NOT an illustration or 3D render.";

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

  // The AI image must contain ZERO drawn text, letters, signage, logos, etc.
  // The REAL brand logo is composited on top of the result after generation.
  const prompt = [
    `High-quality social media image about: ${subject}.`,
    styleLine,
    dateContext,
    brandLine,
    `Tone: ${automation.aiTone || "friendly"}.`,
    "Composition: clean, scroll-stopping, suitable as a 1:1 social post. Leave a small neutral area in a corner (top-left or top-right) free of busy content where a brand logo can be placed without overlapping the subject.",
    "ABSOLUTE PROHIBITION: do NOT draw, render, paint, write, or fabricate ANY text, letters, words, numbers, dates, captions, slogans, taglines, signage, signs, banners, billboards, logos, brand marks, watermarks, signatures, badges, stamps, certificates, screens-with-text, t-shirts-with-text, printed material, phones with visible UI, tablets with visible apps, laptops or monitors with visible content, billboards, or any digital surface that could show readable content. The image must contain ZERO readable characters of any language. Subjects only — physical, real-world (or stylized 3D) objects, people, places, scenes.",
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

    // HARD RULE: composite the REAL BrandKit logo on every generated image.
    // The AI prompt forbids it from drawing any logo (so it doesn't fabricate
    // a fake one), and here we lay the real logo on top via the canonical
    // brand-logo compositor. Skip silently only if the user has no logo set.
    const logoSource = brandKit?.iconLogo || brandKit?.logo || null;
    let finalBuffer = aiBuffer;
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
    } else {
      console.warn(
        `[generate-media] User ${session.userId} has no BrandKit logo set; skipping composite.`,
      );
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
