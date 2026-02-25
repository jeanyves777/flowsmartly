import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { creditService, TRANSACTION_TYPES, CREDIT_TO_CENTS } from "@/lib/credits";
import { generateAdPageHtml, generateAdPageSlug } from "@/lib/ads/ad-page-generator";
import { getPromoteDefaults } from "@/lib/ads/promote-product";

// GET /api/ecommerce/promote?productId=xxx — get pre-filled defaults
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const productId = request.nextUrl.searchParams.get("productId");
    if (!productId) {
      return NextResponse.json(
        { success: false, error: { message: "productId is required" } },
        { status: 400 }
      );
    }

    const defaults = await getPromoteDefaults(productId, session.userId);
    if (!defaults) {
      return NextResponse.json(
        { success: false, error: { message: "Product not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: defaults });
  } catch (error) {
    console.error("Get promote defaults error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to get promotion defaults" } },
      { status: 500 }
    );
  }
}

// POST /api/ecommerce/promote — create product ad campaign
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const gate = await checkPlanAccess(session.user.plan, "Ad campaigns", session.userId);
    if (gate) return gate;

    const body = await request.json();
    const {
      productId,
      headline,
      description,
      ctaText,
      budget,
      dailyBudget,
      costPerView,
      startDate,
      endDate,
      targeting,
    } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: { message: "productId is required" } },
        { status: 400 }
      );
    }

    if (!budget || budget < 1) {
      return NextResponse.json(
        { success: false, error: { message: "Minimum budget is 1 credit" } },
        { status: 400 }
      );
    }

    if (!startDate) {
      return NextResponse.json(
        { success: false, error: { message: "Start date is required" } },
        { status: 400 }
      );
    }

    // Get product defaults
    const defaults = await getPromoteDefaults(productId, session.userId);
    if (!defaults) {
      return NextResponse.json(
        { success: false, error: { message: "Product not found or not yours" } },
        { status: 404 }
      );
    }

    // Check credits
    const creditBudget = Math.round(budget);
    const balance = await creditService.getBalance(session.userId);
    if (balance < creditBudget) {
      return NextResponse.json(
        { success: false, error: { message: `Insufficient credits. Need ${creditBudget}, have ${balance}.` } },
        { status: 400 }
      );
    }

    // Deduct credits
    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditBudget,
      description: `Product promotion: ${defaults.name} (${creditBudget} credits)`,
      referenceType: "ad_campaign",
    });

    const budgetCents = creditBudget * CREDIT_TO_CENTS;
    const dailyBudgetCents = dailyBudget ? Math.round(dailyBudget * 100) : null;

    // Generate ad page
    const slug = generateAdPageSlug();
    const finalHeadline = headline || defaults.headline;
    const finalDescription = description || defaults.description;

    const adPage = await prisma.adPage.create({
      data: {
        slug,
        headline: finalHeadline,
        description: finalDescription,
        mediaUrl: defaults.mediaUrl,
        destinationUrl: defaults.destinationUrl,
        ctaText: ctaText || defaults.ctaText,
        templateStyle: "hero",
      },
    });

    // Create campaign (same as POST /api/ads for PRODUCT_LINK)
    const campaign = await prisma.adCampaign.create({
      data: {
        userId: session.userId,
        name: defaults.name,
        objective: "CONVERSIONS",
        budgetCents,
        dailyBudgetCents,
        cpvCents: Math.round((costPerView || 0.01) * 100),
        targeting: JSON.stringify(targeting || {}),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: "PENDING_REVIEW",
        adType: "PRODUCT_LINK",
        headline: finalHeadline,
        description: finalDescription,
        destinationUrl: defaults.destinationUrl,
        mediaUrl: defaults.mediaUrl,
        ctaText: ctaText || defaults.ctaText,
        adCategory: "E-commerce",
        contentRating: "GENERAL",
        approvalStatus: "PENDING",
        adPageId: adPage.id,
        sourceProductId: defaults.sourceProductId,
        sourceStoreId: defaults.sourceStoreId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        campaignId: campaign.id,
        name: campaign.name,
        status: campaign.status,
        approvalStatus: campaign.approvalStatus,
      },
    });
  } catch (error) {
    console.error("Product promote error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create product promotion" } },
      { status: 500 }
    );
  }
}
