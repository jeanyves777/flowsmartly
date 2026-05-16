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

    const gate = await checkPlanAccess(session.user.plan, "AI landing page builder", session.userId);
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

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function buildLandingPageWhere(userId: string, status: string | null, query: string | null) {
  const where: Record<string, unknown> = { userId };

  if (status === "PUBLISHED" || status === "DRAFT") {
    where.status = status;
  }

  const trimmedQuery = query?.trim();
  if (trimmedQuery) {
    where.OR = [
      { title: { contains: trimmedQuery } },
      { description: { contains: trimmedQuery } },
      { slug: { contains: trimmedQuery } },
      { pageType: { contains: trimmedQuery } },
    ];
  }

  return where;
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
    const query = searchParams.get("q");
    const page = parsePositiveInt(searchParams.get("page"), 1, 1000);
    const limit = parsePositiveInt(searchParams.get("limit"), 12, 50);
    const skip = (page - 1) * limit;

    const where = buildLandingPageWhere(session.user.id, status, query);
    const baseWhere = { userId: session.user.id };

    const [pages, count, totalCount, publishedCount, draftCount, viewStats, totalSubmissions, recentPublishedCount] = await Promise.all([
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
          _count: {
            select: { formSubmissions: true },
          },
        },
      }),
      prisma.landingPage.count({ where }),
      prisma.landingPage.count({ where: baseWhere }),
      prisma.landingPage.count({ where: { ...baseWhere, status: "PUBLISHED" } }),
      prisma.landingPage.count({ where: { ...baseWhere, status: "DRAFT" } }),
      prisma.landingPage.aggregate({
        where: baseWhere,
        _sum: { views: true },
      }),
      prisma.formSubmission.count({
        where: {
          landingPage: {
            is: baseWhere,
          },
        },
      }),
      prisma.landingPage.count({
        where: {
          ...baseWhere,
          status: "PUBLISHED",
          publishedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const pagesWithMetrics = pages.map((page) => {
      const submissions = page._count.formSubmissions;
      const conversionRate = page.views > 0 ? Number(((submissions / page.views) * 100).toFixed(1)) : 0;
      const { _count, ...pageData } = page;
      return {
        ...pageData,
        submissions,
        conversionRate,
      };
    });

    const totalViews = viewStats._sum.views || 0;

    return NextResponse.json({
      success: true,
      data: {
        pages: pagesWithMetrics,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
        stats: {
          total: totalCount,
          published: publishedCount,
          draft: draftCount,
          totalViews,
          totalSubmissions,
          averageConversionRate: totalViews > 0 ? Number(((totalSubmissions / totalViews) * 100).toFixed(1)) : 0,
          recentlyPublished: recentPublishedCount,
        },
        workflow: [
          {
            id: "create",
            label: "Create",
            description: "Describe the offer, audience, proof, and action you want the page to drive.",
            completed: totalCount > 0,
          },
          {
            id: "review",
            label: "Review",
            description: "Edit the AI copy, check the mobile layout, and confirm the form or call-to-action.",
            completed: publishedCount > 0 || draftCount > 0,
          },
          {
            id: "publish",
            label: "Publish",
            description: "Publish the page, copy the public URL, and connect it to campaigns or ads.",
            completed: publishedCount > 0,
          },
          {
            id: "optimize",
            label: "Optimize",
            description: "Use views, leads, and conversion rate to improve each page after launch.",
            completed: totalViews > 0 || totalSubmissions > 0,
          },
        ],
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
