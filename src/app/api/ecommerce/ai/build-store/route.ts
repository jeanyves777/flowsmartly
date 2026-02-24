import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { z } from "zod";
import { generateStoreBlueprint } from "@/lib/ai/generators/store-builder";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { generateSlug } from "@/lib/constants/ecommerce";
import { getTemplateById } from "@/lib/constants/store-templates";

// ── Request Schema ──

const requestSchema = z.object({
  storeName: z.string().min(1).max(200),
  industry: z.string().min(1).max(100),
  niche: z.string().max(200).optional(),
  targetAudience: z.string().max(500).optional(),
  region: z.string().max(50).optional(),
  currency: z.string().max(10).optional(),
});

// ── POST /api/ecommerce/ai/build-store ──
// Orchestrates AI store generation + persistence (template + content + products)

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Credit check
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_STORE_BUILD");
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 402 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.errors.map((e) => e.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    const { storeName, industry, niche, targetAudience, region, currency } = parsed.data;

    // Get user's store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true, currency: true, region: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You must activate FlowShop before building a store." } },
        { status: 404 }
      );
    }

    // Fetch user's brand kit for brand-aware generation
    let brandColors: { primary?: string; secondary?: string; accent?: string } | undefined;
    let brandFonts: { heading?: string; body?: string } | undefined;
    let brandLogo: string | undefined;

    try {
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId, isDefault: true },
      }) || await prisma.brandKit.findFirst({
        where: { userId: session.userId },
      });

      if (brandKit) {
        try {
          const colors = JSON.parse(brandKit.colors || "{}");
          if (colors.primary) brandColors = colors;
        } catch {}
        try {
          const fonts = JSON.parse(brandKit.fonts || "{}");
          if (fonts.heading) brandFonts = fonts;
        } catch {}
        if (brandKit.logo) brandLogo = brandKit.logo;
      }
    } catch {}

    // Generate AI blueprint
    const blueprint = await generateStoreBlueprint({
      storeName,
      industry,
      niche,
      targetAudience,
      region: region || store.region || undefined,
      currency: currency || store.currency || "USD",
      brandColors,
      brandFonts,
      brandLogo,
    });

    if (!blueprint) {
      return NextResponse.json(
        { success: false, error: { code: "AI_GENERATION_FAILED", message: "AI failed to generate the store blueprint. Please try again." } },
        { status: 500 }
      );
    }

    // Resolve template config, then overlay brand colors/fonts if available
    const templateConfig = getTemplateById(blueprint.templateId);
    const themeColors: Record<string, string> = templateConfig ? { ...templateConfig.colors } : {};
    const themeFonts: Record<string, string> = templateConfig ? { ...templateConfig.fonts } : {};
    const themeLayout: Record<string, string> = templateConfig ? { ...templateConfig.layout } : {};

    // Brand colors take priority over template defaults
    if (brandColors?.primary) themeColors.primary = brandColors.primary;
    if (brandColors?.secondary) themeColors.secondary = brandColors.secondary;
    if (brandColors?.accent) themeColors.accent = brandColors.accent;
    if (brandFonts?.heading) themeFonts.heading = brandFonts.heading;
    if (brandFonts?.body) themeFonts.body = brandFonts.body;

    const themeJSON = JSON.stringify({
      template: templateConfig?.id || blueprint.templateId,
      colors: themeColors,
      fonts: themeFonts,
      layout: themeLayout,
    });

    // Build settings JSON from blueprint content
    // Sections format must match the store page renderer: { id, enabled, order, content }
    // Product-first layout: hero (compact) -> categories -> featured -> new arrivals -> deals -> about
    const settingsJSON = JSON.stringify({
      sections: [
        {
          id: "hero",
          enabled: true,
          order: 0,
          content: {
            headline: blueprint.content.hero.headline,
            subheadline: blueprint.content.hero.subheadline,
            ctaText: blueprint.content.hero.ctaText,
            ctaLink: "/products",
          },
        },
        {
          id: "category_showcase",
          enabled: true,
          order: 1,
          content: { title: "Shop by Category" },
        },
        {
          id: "featured_products",
          enabled: true,
          order: 2,
          content: { title: "Featured Products", count: 8 },
        },
        {
          id: "new_arrivals",
          enabled: true,
          order: 3,
          content: { title: "New Arrivals", count: 8 },
        },
        {
          id: "deals",
          enabled: true,
          order: 4,
          content: { title: "Deals & Offers", count: 8 },
        },
        {
          id: "about",
          enabled: true,
          order: 5,
          content: {
            title: blueprint.content.about.title,
            body: blueprint.content.about.body,
          },
        },
        {
          id: "newsletter",
          enabled: true,
          order: 6,
          content: { title: "Stay Updated", subtitle: `Get the latest from ${storeName}` },
        },
      ],
      storeContent: {
        tagline: blueprint.content.tagline,
        aboutUs: blueprint.content.about.body,
        returnPolicy: blueprint.content.returnPolicy,
        shippingPolicy: blueprint.content.shippingPolicy,
        faq: blueprint.content.faq,
      },
    });

    // Persist everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update store with theme, settings, and SEO description
      const storeUpdateData: Record<string, unknown> = {
        name: storeName,
        theme: themeJSON,
        settings: settingsJSON,
        description: blueprint.seo.description,
        industry,
      };
      // Apply brand logo if available and store doesn't have one
      if (brandLogo) storeUpdateData.logoUrl = brandLogo;

      await tx.store.update({
        where: { id: store.id },
        data: storeUpdateData,
      });

      // 2. Delete existing draft products for cleanup (in case of regeneration)
      await tx.product.deleteMany({
        where: { storeId: store.id, status: "DRAFT" },
      });

      // 3. Delete existing categories for cleanup (in case of regeneration)
      await tx.productCategory.deleteMany({
        where: { storeId: store.id },
      });

      // 4. Create product categories
      const categoryRecords = await Promise.all(
        blueprint.categories.map((cat) =>
          tx.productCategory.create({
            data: {
              storeId: store.id,
              name: cat.name,
              slug: generateSlug(cat.name),
              description: cat.description,
              sortOrder: cat.sortOrder,
            },
          })
        )
      );

      // Build a lookup map: category name -> category ID
      const categoryMap = new Map<string, string>();
      for (const cat of categoryRecords) {
        categoryMap.set(cat.name, cat.id);
      }

      // 5. Create products with variants
      const productRecords = await Promise.all(
        blueprint.products.map(async (prod) => {
          const categoryId = categoryMap.get(prod.category) || null;

          const product = await tx.product.create({
            data: {
              storeId: store.id,
              name: prod.name,
              slug: generateSlug(prod.name),
              description: prod.description,
              shortDescription: prod.shortDescription,
              category: prod.category,
              categoryId,
              priceCents: prod.priceCents,
              comparePriceCents: prod.comparePriceCents || null,
              currency: currency || store.currency || "USD",
              tags: JSON.stringify(prod.tags || []),
              seoTitle: prod.seoTitle,
              seoDescription: prod.seoDescription,
              status: "DRAFT",
            },
          });

          // Create variants if provided
          if (prod.variants && prod.variants.length > 0) {
            await Promise.all(
              prod.variants.map((variant) =>
                tx.productVariant.create({
                  data: {
                    productId: product.id,
                    name: variant.name,
                    priceCents: variant.priceCents,
                    options: JSON.stringify(variant.options),
                  },
                })
              )
            );
          }

          return product;
        })
      );

      return {
        categoryIds: categoryRecords.map((c) => c.id),
        productIds: productRecords.map((p) => p.id),
      };
    });

    // Deduct credits after successful persistence
    const cost = await getDynamicCreditCost("AI_STORE_BUILD");
    await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: `AI store builder: ${storeName} (${industry})`,
      referenceType: "store",
      referenceId: store.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        blueprint,
        productIds: result.productIds,
        categoryIds: result.categoryIds,
      },
    });
  } catch (error) {
    console.error("AI store build error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to build store" } },
      { status: 500 }
    );
  }
}
