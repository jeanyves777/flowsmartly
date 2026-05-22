import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { generateImageXaiFirst } from "@/lib/ai/image-router";
import { uploadToS3 } from "@/lib/utils/s3-client";

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

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id: campaignId, autoId } = await params;
  const body = (await request.json().catch(() => ({}))) as { tier?: string };
  const tier = body.tier === "premium" ? "premium" : "standard";

  const automation = await prisma.contentAutomation.findFirst({
    where: { id: autoId, campaignId, userId: session.userId },
    select: {
      id: true,
      name: true,
      topic: true,
      aiPrompt: true,
      aiTone: true,
      aiMediaConfig: true,
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

  // Build brand-aware image prompt
  let brandKit = await prisma.brandKit.findFirst({
    where: { userId: session.userId, isDefault: true },
  });
  if (!brandKit) {
    brandKit = await prisma.brandKit.findFirst({ where: { userId: session.userId } });
  }

  const subject =
    automation.topic ||
    automation.aiPrompt ||
    automation.calendarSourceLabel ||
    automation.name;

  const style = aiConfig.style || "natural";
  const brandLine = brandKit
    ? `Brand: ${brandKit.name}${brandKit.description ? ` — ${brandKit.description}` : ""}.`
    : "";

  const prompt = [
    `High-quality social media image about: ${subject}.`,
    brandLine,
    `Style: ${style}. Tone: ${automation.aiTone || "friendly"}.`,
    "Composition: clean, scroll-stopping, suitable as a 1:1 social post. No text overlays unless explicitly requested.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    // Tier mapping: Premium = OpenAI (preferred, with fallback to xAI on failure),
    // Standard = xAI (preferred). Provider names never leak to the UI.
    const preferredProvider = tier === "premium" ? "openai" : "xai";
    const result = await generateImageXaiFirst(prompt, 1024, 1024, {
      quality: tier === "premium" ? "high" : "medium",
      preferredProvider,
    });
    if (!result.base64) {
      throw new Error("Image generator returned no image");
    }
    const buffer = Buffer.from(result.base64, "base64");
    const key = `campaigns/${session.userId}/${autoId}-${Date.now()}.png`;
    const url = await uploadToS3(key, buffer, "image/png");

    // Set the URL + switch to UPLOAD mode so the scheduler uses this exact image.
    const updated = await prisma.contentAutomation.update({
      where: { id: autoId },
      data: {
        mediaUrl: url,
        mediaMode: "UPLOAD",
      },
      select: { id: true, mediaUrl: true, mediaMode: true },
    });

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
