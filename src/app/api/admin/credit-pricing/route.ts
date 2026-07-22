import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import { clearPricingCache } from "@/lib/credits/costs";

// Default credit pricing configuration (used to seed database)
const DEFAULT_PRICING: {
  key: string;
  name: string;
  description: string;
  credits: number;
  category: string;
}[] = [
  // AI Text Generation — GPT-4o-mini ~$0.01-0.03 per call
  { key: "AI_POST", name: "AI Post Generation", description: "Generate social media posts using AI", credits: 3, category: "ai_text" },
  { key: "AI_CAPTION", name: "AI Caption Generation", description: "Generate captions for images and videos", credits: 3, category: "ai_text" },
  { key: "AI_HASHTAGS", name: "AI Hashtag Generation", description: "Generate relevant hashtags for posts", credits: 2, category: "ai_text" },
  { key: "AI_IDEAS", name: "AI Idea Generation", description: "Generate content ideas and suggestions", credits: 3, category: "ai_text" },
  { key: "AI_AUTO", name: "AI Auto-Generate", description: "Automatically generate content based on context", credits: 3, category: "ai_text" },
  { key: "AI_AUDIENCE", name: "AI Audience Targeting", description: "AI-powered audience targeting suggestions", credits: 3, category: "ai_text" },
  { key: "AI_CAMPAIGN_NAME", name: "AI Campaign Name", description: "Generate campaign name suggestions", credits: 2, category: "ai_text" },
  // AI Branding — text generation + structured output
  { key: "AI_BRAND_KIT", name: "AI Brand Kit Generation", description: "Generate complete brand kit with colors, fonts, and guidelines", credits: 8, category: "ai_branding" },
  // AI Image Generation — OpenAI/xAI/Gemini ~$0.03-0.08 per image
  { key: "AI_LOGO_CONCEPTS", name: "AI Logo Concepts (Legacy)", description: "Generate SVG logo concepts", credits: 10, category: "ai_image" },
  { key: "AI_LOGO_FINALIZE", name: "AI Logo Finalization (Legacy)", description: "Finalize a single logo image", credits: 15, category: "ai_image" },
  { key: "AI_LOGO_GENERATION", name: "AI Logo Generation", description: "Generate 3 professional logo concepts with transparent backgrounds (~$0.24)", credits: 40, category: "ai_image" },
  { key: "AI_VISUAL_DESIGN", name: "AI Visual Design", description: "Generate a single visual design/graphic (~$0.08)", credits: 15, category: "ai_image" },
  { key: "AI_MARKETING_IMAGE", name: "AI Marketing Image", description: "Single image for MMS/email campaigns (~$0.06)", credits: 12, category: "ai_image" },
  // AI Video Generation
  { key: "AI_CARTOON_VIDEO", name: "Legacy AI Cartoon Video", description: "Legacy cartoon pipeline", credits: 80, category: "ai_video" },
  { key: "AI_CARTOON_CHARACTER_REGEN", name: "AI Character Regeneration", description: "Regenerate a single character preview image", credits: 10, category: "ai_video" },
  // AI Video Studio
  { key: "AI_VIDEO_STUDIO", name: "AI Video Studio (Veo 3)", description: "Veo 3 AI video per 8s clip (~$0.35 Google cost)", credits: 60, category: "ai_video" },
  { key: "AI_VIDEO_SLIDESHOW", name: "Story Ad Movie", description: "Direct xAI story ad video generation", credits: 25, category: "ai_video" },
  // AI Landing Page — Claude text generation
  { key: "AI_LANDING_PAGE", name: "AI Landing Page", description: "Generate a full landing page via AI (~$0.10)", credits: 20, category: "ai_text" },
  // AI Chat Assistant
  { key: "AI_CHAT_MESSAGE", name: "FlowAI Chat Message", description: "Send a text message to FlowAI assistant", credits: 2, category: "ai_chat" },
  { key: "AI_CHAT_IMAGE", name: "FlowAI Image Generation", description: "Generate an image via FlowAI chat (~$0.08)", credits: 15, category: "ai_chat" },
  { key: "AI_CHAT_VIDEO", name: "FlowAI Video Generation", description: "Generate a video via FlowAI chat (~$0.35)", credits: 60, category: "ai_chat" },
  // Messaging
  { key: "EMAIL_SEND", name: "Email Send", description: "Send a single marketing email (~$0.001)", credits: 1, category: "marketing" },
  { key: "SMS_SEND", name: "SMS Send", description: "Send a single SMS message (~$0.008)", credits: 3, category: "marketing" },
  { key: "MMS_SEND", name: "MMS Send", description: "Send a single MMS message with image (~$0.02)", credits: 5, category: "marketing" },
  // AI Image Tools
  { key: "AI_BG_REMOVE", name: "AI Background Removal", description: "Remove background from a single image (rembg, server-side)", credits: 1, category: "ai_image" },
  // Training Room — AI presenter + deck media (previously hardcoded in the routes)
  { key: "PRESENTER_MOMENT_VIDEO", name: "Training: Presenter Video", description: "One 8s talking-presenter intro/outro/moment clip (~$0.45)", credits: 50, category: "ai_video" },
  { key: "PRESENTER_ANSWER", name: "Training: Presenter Q&A Answer", description: "One AI answer + short TTS reply (~$0.015)", credits: 3, category: "ai_chat" },
  { key: "PRESENTER_STYLE", name: "Training: Presenter Portrait", description: "Presentation-ready presenter portrait (identity image-to-image)", credits: 18, category: "ai_image" },
  { key: "TRAINING_BACKGROUND", name: "Training: AI Background", description: "One 16:9 AI virtual background image (~$0.05)", credits: 12, category: "ai_image" },
  { key: "PRESENTER_NARRATE_BASE", name: "Training: Narration (base)", description: "Deck narration script generation", credits: 4, category: "ai_text" },
  { key: "PRESENTER_NARRATE_PER_SLIDE", name: "Training: Narration (per slide)", description: "Deck narration TTS per slide", credits: 4, category: "ai_text" },
  { key: "TRAINING_DECK_BASE", name: "Training: AI Deck (base)", description: "AI presentation outline", credits: 12, category: "ai_text" },
  { key: "TRAINING_DECK_IMAGE", name: "Training: AI Deck (per slide image)", description: "Per generated slide image", credits: 15, category: "ai_image" },
  { key: "AI_AVATAR_VIDEO", name: "AI Avatar Video (Standard)", description: "HeyGen standard talking-avatar, per 30s (~$0.51)", credits: 40, category: "ai_video" },
  { key: "AI_AVATAR_VIDEO_PREMIUM", name: "AI Avatar Video (Premium)", description: "HeyGen Avatar IV photoreal, per 30s (~$2). Sized to cover HeyGen's ~$4/min.", credits: 160, category: "ai_video" },
  { key: "AI_VIDEO_LITE", name: "AI Video (Standard/Lite)", description: "Veo Lite per 8s clip (~$0.30)", credits: 30, category: "ai_video" },
  // Lead search — result-scaled so it covers Google Places Place Details cost
  { key: "LOCAL_LEAD_SEARCH_BASE", name: "Lead Search (base)", description: "Per Google Places lead search (covers the Text Search)", credits: 5, category: "ai_text" },
  { key: "LOCAL_LEAD_PER_RESULT", name: "Lead Search (per business)", description: "Per business found + saved (covers ~$0.025 Place Details)", credits: 2, category: "ai_text" },
  // Pitch / proposal
  { key: "PITCH", name: "AI Outreach Pitch", description: "Researched cold-outreach pitch (~$0.10)", credits: 15, category: "ai_text" },
  { key: "PITCH_SUGGEST", name: "AI Pitch Field Suggestion", description: "Per-field AI suggestion in the Pitch editor", credits: 3, category: "ai_text" },
  { key: "AI_SERVICE_PROPOSAL", name: "AI Service Proposal", description: "Branded service proposal PDF (~$0.35)", credits: 35, category: "ai_text" },
];

// GET /api/admin/credit-pricing - List all credit pricing
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const pricing = await prisma.creditPricing.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    // Get categories for filtering
    const categories = await prisma.creditPricing.groupBy({
      by: ["category"],
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        pricing,
        categories: categories.map((c) => ({
          name: c.category,
          count: c._count.id,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching credit pricing:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch credit pricing" } },
      { status: 500 }
    );
  }
}

// POST /api/admin/credit-pricing - Seed default pricing or create new
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    // Seed default pricing
    if (action === "seed") {
      const results = await Promise.all(
        DEFAULT_PRICING.map(async (item) => {
          return prisma.creditPricing.upsert({
            where: { key: item.key },
            update: {}, // Don't update existing values when seeding
            create: {
              key: item.key,
              name: item.name,
              description: item.description,
              credits: item.credits,
              category: item.category,
              updatedBy: session.adminId,
            },
          });
        })
      );

      // Clear cache after seeding
      clearPricingCache();

      return NextResponse.json({
        success: true,
        data: { seeded: results.length },
        message: `Seeded ${results.length} pricing entries`,
      });
    }

    // Create new pricing entry
    const { key, name, description, credits, category } = body;

    if (!key || !name || credits === undefined) {
      return NextResponse.json(
        { success: false, error: { message: "Key, name, and credits are required" } },
        { status: 400 }
      );
    }

    // Check for duplicate key
    const existing = await prisma.creditPricing.findUnique({ where: { key } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { message: "Pricing key already exists" } },
        { status: 409 }
      );
    }

    const pricing = await prisma.creditPricing.create({
      data: {
        key,
        name,
        description: description || null,
        credits: parseInt(credits, 10),
        category: category || "general",
        updatedBy: session.adminId,
      },
    });

    // Clear cache after creating new pricing
    clearPricingCache();

    return NextResponse.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    console.error("Error creating credit pricing:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create credit pricing" } },
      { status: 500 }
    );
  }
}

// PUT /api/admin/credit-pricing - Update pricing
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, credits, name, description, isActive, category } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Pricing ID is required" } },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedBy: session.adminId,
    };

    if (credits !== undefined) updateData.credits = parseInt(credits, 10);
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (category !== undefined) updateData.category = category;

    const pricing = await prisma.creditPricing.update({
      where: { id },
      data: updateData,
    });

    // Clear cache after updating pricing
    clearPricingCache();

    return NextResponse.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    console.error("Error updating credit pricing:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update credit pricing" } },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/credit-pricing - Delete pricing (soft delete by setting isActive=false)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Pricing ID is required" } },
        { status: 400 }
      );
    }

    // Soft delete - just disable it
    const pricing = await prisma.creditPricing.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: session.adminId,
      },
    });

    // Clear cache after disabling pricing
    clearPricingCache();

    return NextResponse.json({
      success: true,
      data: pricing,
      message: "Pricing entry disabled",
    });
  } catch (error) {
    console.error("Error deleting credit pricing:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete credit pricing" } },
      { status: 500 }
    );
  }
}
