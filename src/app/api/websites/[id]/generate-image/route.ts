import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getSiteDir } from "@/lib/website/site-builder";

/**
 * POST /api/websites/[id]/generate-image
 * Generates an AI image using OpenAI gpt-image-1 and saves it to the site.
 * Costs AI_VISUAL_DESIGN credits (15 credits = $0.15).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, generatedPath: true, name: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Check credits
    const cost = await getDynamicCreditCost("AI_VISUAL_DESIGN");
    const check = await checkCreditsForFeature(session.userId, "AI_VISUAL_DESIGN");
    if (check) {
      return NextResponse.json({
        error: check.message,
        required: cost,
        code: "INSUFFICIENT_CREDITS",
      }, { status: 402 });
    }

    const body = await request.json();
    const { prompt, category, size } = body;

    if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

    // Generate image with OpenAI
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: size || "1536x1024",
      quality: "medium",
    });

    const imageData = response.data?.[0];
    if (!imageData?.b64_json) {
      return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
    }

    // Save to site directory
    const siteDir = website.generatedPath || getSiteDir(id);
    const imgCategory = category || "generated";
    const imgDir = join(siteDir, "public", "images", imgCategory);
    mkdirSync(imgDir, { recursive: true });

    const filename = `ai-${Date.now()}.png`;
    const buffer = Buffer.from(imageData.b64_json, "base64");
    writeFileSync(join(imgDir, filename), buffer);

    const imagePath = `/images/${imgCategory}/${filename}`;

    // Deduct credits
    await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: `AI image for website: ${prompt.substring(0, 50)}`,
    });

    return NextResponse.json({ success: true, path: imagePath, cost });
  } catch (err) {
    console.error("Generate image error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
