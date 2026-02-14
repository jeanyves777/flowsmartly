import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { presignAllUrls } from "@/lib/utils/s3-client";

// Helper: accept string, undefined, or null (DB returns null for empty fields)
const optionalString = (max?: number) => {
  const base = max ? z.string().max(max) : z.string();
  return base.optional().or(z.null());
};

const brandKitSchema = z.object({
  name: z.string().min(2, "Brand name must be at least 2 characters").max(100),
  tagline: optionalString(200),
  description: optionalString(1000),
  logo: optionalString(),
  iconLogo: optionalString(),
  industry: optionalString(100),
  niche: optionalString(200),
  targetAudience: optionalString(500),
  audienceAge: optionalString(100),
  audienceLocation: optionalString(200),
  voiceTone: z.enum(["professional", "casual", "playful", "inspirational", "educational", "friendly", "authoritative"]).optional().or(z.null()),
  personality: z.array(z.string()).optional().or(z.null()),
  keywords: z.array(z.string()).optional().or(z.null()),
  avoidWords: z.array(z.string()).optional().or(z.null()),
  colors: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
  }).optional().or(z.null()),
  fonts: z.object({
    heading: z.string().optional(),
    body: z.string().optional(),
  }).optional().or(z.null()),
  guidelines: optionalString(5000),
  hashtags: z.array(z.string()).optional().or(z.null()),
  handles: z.object({
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    facebook: z.string().optional(),
    youtube: z.string().optional(),
    tiktok: z.string().optional(),
  }).optional().or(z.null()),
  products: z.array(z.string()).optional().or(z.null()),
  uniqueValue: optionalString(500),
  email: optionalString(200),
  phone: optionalString(50),
  website: optionalString(300),
  address: optionalString(500),
});

// GET /api/brand - Get user's brand identity
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    // Find user's default brand kit
    let brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });

    // If no default, find any brand kit
    if (!brandKit) {
      brandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId },
      });
    }

    if (!brandKit) {
      return NextResponse.json({
        success: true,
        data: { brandKit: null, hasSetup: false },
      });
    }

    // Parse JSON fields
    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        brandKit: {
          ...brandKit,
          personality: JSON.parse(brandKit.personality),
          keywords: JSON.parse(brandKit.keywords),
          avoidWords: JSON.parse(brandKit.avoidWords),
          colors: JSON.parse(brandKit.colors),
          fonts: JSON.parse(brandKit.fonts),
          hashtags: JSON.parse(brandKit.hashtags),
          handles: JSON.parse(brandKit.handles),
          products: JSON.parse(brandKit.products),
        },
        hasSetup: brandKit.isComplete,
      }),
    });
  } catch (error) {
    console.error("Get brand identity error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch brand identity" } },
      { status: 500 }
    );
  }
}

// POST /api/brand - Create or update brand identity
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
    const validation = brandKitSchema.safeParse(body);

    if (!validation.success) {
      console.error("Brand validation errors:", JSON.stringify(validation.error.flatten().fieldErrors));
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

    const data = validation.data;

    // Check if user already has a brand kit
    const existingBrandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
    });

    const brandKitData = {
      name: data.name,
      tagline: data.tagline || null,
      description: data.description || null,
      logo: data.logo || null,
      iconLogo: data.iconLogo || null,
      industry: data.industry || null,
      niche: data.niche || null,
      targetAudience: data.targetAudience || null,
      audienceAge: data.audienceAge || null,
      audienceLocation: data.audienceLocation || null,
      voiceTone: data.voiceTone || null,
      personality: JSON.stringify(data.personality || []),
      keywords: JSON.stringify(data.keywords || []),
      avoidWords: JSON.stringify(data.avoidWords || []),
      colors: JSON.stringify(data.colors || {}),
      fonts: JSON.stringify(data.fonts || {}),
      guidelines: data.guidelines || null,
      hashtags: JSON.stringify(data.hashtags || []),
      handles: JSON.stringify(data.handles || {}),
      products: JSON.stringify(data.products || []),
      uniqueValue: data.uniqueValue || null,
      email: data.email || null,
      phone: data.phone || null,
      website: data.website || null,
      address: data.address || null,
      isDefault: true,
      isComplete: !!(data.name && data.industry && data.targetAudience && data.voiceTone),
    };

    let brandKit;
    if (existingBrandKit) {
      brandKit = await prisma.brandKit.update({
        where: { id: existingBrandKit.id },
        data: brandKitData,
      });
    } else {
      brandKit = await prisma.brandKit.create({
        data: {
          ...brandKitData,
          userId: session.userId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        brandKit: {
          ...brandKit,
          personality: JSON.parse(brandKit.personality),
          keywords: JSON.parse(brandKit.keywords),
          avoidWords: JSON.parse(brandKit.avoidWords),
          colors: JSON.parse(brandKit.colors),
          fonts: JSON.parse(brandKit.fonts),
          hashtags: JSON.parse(brandKit.hashtags),
          handles: JSON.parse(brandKit.handles),
          products: JSON.parse(brandKit.products),
        },
      }),
    });
  } catch (error) {
    console.error("Save brand identity error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SAVE_FAILED", message: "Failed to save brand identity" } },
      { status: 500 }
    );
  }
}
