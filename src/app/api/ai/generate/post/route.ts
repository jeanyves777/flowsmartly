import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { prisma } from "@/lib/db/client";
import { aiHub } from "@/lib/ai";
import type { Platform, ToneType, LengthType } from "@/lib/ai";

// Validation schema
const generatePostSchema = z.object({
  platforms: z.array(z.enum(["instagram", "twitter", "linkedin", "facebook", "youtube"])).min(1),
  topic: z.string().min(10, "Topic must be at least 10 characters").max(500),
  tone: z.enum(["professional", "casual", "humorous", "inspirational", "educational"]),
  length: z.enum(["short", "medium", "long"]),
  includeHashtags: z.boolean().default(true),
  includeEmojis: z.boolean().default(true),
  includeCTA: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Please log in to generate content",
          },
        },
        { status: 401 }
      );
    }

    const gate = await checkPlanAccess(session.user.plan, "AI post generation", session.userId);
    if (gate) return gate;

    // Parse and validate request body
    const body = await request.json();
    const validation = generatePostSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { platforms, topic, tone, length, includeHashtags, includeEmojis, includeCTA } = validation.data;

    // Get user's brand context for enhanced generation
    const brandContext = await aiHub.getBrandContext(session.userId);

    // Use AI Hub to generate post
    const result = await aiHub.generatePost({
      userId: session.userId,
      platforms: platforms as Platform[],
      topic,
      settings: {
        tone: tone as ToneType,
        length: length as LengthType,
        includeHashtags,
        includeEmojis,
        includeCTA,
      },
      brandContext: brandContext || undefined,
      sessionCredits: session.user.aiCredits,
      adminId: session.adminId, // For admin usage tracking
    });

    if (!result.success) {
      const statusCode = result.error?.code === "INSUFFICIENT_CREDITS" ? 403 : 500;
      return NextResponse.json({ success: false, error: result.error }, { status: statusCode });
    }

    // Save to Generated Content Library
    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: "post",
        content: result.data?.content || "",
        prompt: topic,
        platforms: JSON.stringify(platforms),
        settings: JSON.stringify({ tone, length, includeHashtags, includeEmojis, includeCTA }),
      },
    });

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Post generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Failed to generate content",
        },
      },
      { status: 500 }
    );
  }
}
