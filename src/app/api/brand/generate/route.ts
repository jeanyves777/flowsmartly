import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { aiHub } from "@/lib/ai";

const generateSchema = z.object({
  description: z.string().min(20, "Please provide more details about your business").max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = generateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message } },
        { status: 400 }
      );
    }

    const { description } = validation.data;

    // Use AI Hub to generate brand identity
    const result = await aiHub.generateBrand({
      userId: session.userId,
      description,
      sessionCredits: session.user.aiCredits,
      adminId: session.adminId, // For admin usage tracking
    });

    if (!result.success) {
      const statusCode = result.error?.code === "INSUFFICIENT_CREDITS" ? 403 : 500;
      return NextResponse.json({ success: false, error: result.error }, { status: statusCode });
    }

    // Format the result for the frontend
    const brandKit = {
      name: result.data?.name || "",
      tagline: result.data?.tagline || "",
      description: result.data?.description || "",
      industry: result.data?.industry || "",
      niche: result.data?.niche || "",
      targetAudience: result.data?.targetAudience || "",
      audienceAge: result.data?.audienceAge || "",
      audienceLocation: result.data?.audienceLocation || "",
      voiceTone: result.data?.voiceTone || "professional",
      personality: result.data?.personality || [],
      keywords: result.data?.keywords || [],
      hashtags: result.data?.hashtags || [],
      products: result.data?.products || [],
      uniqueValue: result.data?.uniqueValue || "",
      handles: {},
      colors: { primary: "#0ea5e9", secondary: "#8b5cf6", accent: "#f59e0b" },
      avoidWords: [],
    };

    return NextResponse.json({
      success: true,
      data: {
        brandKit,
        creditsUsed: result.data?.creditsUsed,
      },
    });
  } catch (error) {
    console.error("Brand generation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: "Failed to generate brand identity" } },
      { status: 500 }
    );
  }
}
