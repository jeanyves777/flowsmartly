import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { generateLandingPage } from "@/lib/landing-pages/generator";
import { sanitizeHtml } from "@/lib/landing-pages/sanitizer";
import { findTemplateVariant } from "@/lib/landing-pages/templates";

/**
 * Slugify a string: lowercase, replace spaces/special chars with hyphens, remove non-alphanumeric
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate a unique, SEO-friendly slug.
 * Format: {brand}-{title}-{random6} e.g. "fittrack-workout-tracker-app-a3x9k2"
 */
async function generateUniqueSlug(title: string, brandName?: string): Promise<string> {
  // Build slug parts: brand + title
  const parts: string[] = [];
  if (brandName) parts.push(slugify(brandName));
  parts.push(slugify(title) || "landing-page");
  const base = parts.join("-").substring(0, 60); // Cap at 60 chars before suffix

  // Always append a 6-char random suffix for uniqueness
  const suffix = Math.random().toString(36).substring(2, 8);
  const slug = `${base}-${suffix}`;

  // Double-check uniqueness (extremely unlikely collision)
  const existing = await prisma.landingPage.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existing) {
    const extra = Math.random().toString(36).substring(2, 6);
    return `${base}-${suffix}${extra}`;
  }

  return slug;
}

// POST /api/landing-pages - Generate a new landing page with AI
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const gate = checkPlanAccess(session.user.plan, "AI landing page builder");
    if (gate) return gate;

    // Check credits (free credits can only be used for email marketing)
    const creditCost = await getDynamicCreditCost("AI_LANDING_PAGE");
    const creditCheck = await checkCreditsForFeature(session.user.id, "AI_LANDING_PAGE");
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const { prompt, pageType, brandName, colors, tone, audience, ctaText, keywords, imageUrl, videoUrl, logoUrl, ctaUrl, formConfig, templateId } = body as {
      prompt?: string;
      pageType?: string;
      brandName?: string;
      colors?: { primary?: string; secondary?: string; accent?: string };
      tone?: string;
      audience?: string;
      ctaText?: string;
      keywords?: string;
      imageUrl?: string;
      videoUrl?: string;
      logoUrl?: string;
      ctaUrl?: string;
      formConfig?: { name: string; label: string; type: string; required: boolean }[];
      templateId?: string;
    };

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Prompt is required" } },
        { status: 400 }
      );
    }

    if (!pageType || !pageType.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Page type is required" } },
        { status: 400 }
      );
    }

    // Resolve template variant if selected — layout/structure only, colors come from brand
    const variant = templateId ? findTemplateVariant(templateId) : null;
    const templatePrompt = variant?.variant.detailedPrompt;

    // Generate landing page with AI
    const generated = await generateLandingPage({
      prompt,
      pageType,
      brandName,
      colors,
      tone,
      audience,
      ctaText,
      keywords,
      imageUrl,
      videoUrl,
      logoUrl,
      ctaUrl,
      templatePrompt,
      ...(Array.isArray(formConfig) ? { formFields: formConfig } : {}),
    });

    // Sanitize the generated HTML
    const sanitizedHtml = sanitizeHtml(generated.html);

    // Generate unique SEO-friendly slug with brand name
    const slug = await generateUniqueSlug(generated.title, brandName);

    // Create landing page record
    const page = await prisma.landingPage.create({
      data: {
        userId: session.user.id,
        title: generated.title,
        slug,
        description: generated.description,
        pageType,
        prompt,
        htmlContent: sanitizedHtml,
        status: "DRAFT",
        formConfig: JSON.stringify(formConfig || {}),
        settings: JSON.stringify({
          brandName,
          colors,
          tone,
          audience,
          ctaText,
          keywords,
          imageUrl,
          videoUrl,
          logoUrl,
          ctaUrl,
        }),
      },
    });

    // Deduct credits
    await creditService.deductCredits({
      userId: session.user.id,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditCost,
      description: "AI landing page generation",
      referenceType: "landing_page",
      referenceId: page.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        page: {
          ...page,
          settings: JSON.parse(page.settings),
        },
        creditsUsed: creditCost,
      },
    });
  } catch (error) {
    console.error("Landing page generation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate landing page" } },
      { status: 500 }
    );
  }
}

// GET /api/landing-pages - List user's landing pages
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "12", 10);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (status) {
      where.status = status;
    }

    const [pages, count] = await Promise.all([
      prisma.landingPage.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          pageType: true,
          status: true,
          thumbnailUrl: true,
          views: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.landingPage.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        pages,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error("Landing pages list error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch landing pages" } },
      { status: 500 }
    );
  }
}
