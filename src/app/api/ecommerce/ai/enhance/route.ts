import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { z } from "zod";
import { generateStoreEnhancement } from "@/lib/ai/generators/store-enhance";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { generateSlug } from "@/lib/constants/ecommerce";

const requestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  referenceUrl: z.string().url().optional(),
  scope: z.enum(["theme", "content", "products", "all"]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const creditCheck = await checkCreditsForFeature(session.userId, "AI_STORE_ENHANCE");
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 402 }
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors.map((e) => e.message).join(", ") } },
        { status: 400 }
      );
    }

    const { prompt, referenceUrl, scope } = parsed.data;

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true, name: true, industry: true, theme: true, settings: true, currency: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "No store found." } },
        { status: 404 }
      );
    }

    // Get brief product summary for context
    let productSummary = "";
    if (scope === "products" || scope === "all") {
      const products = await prisma.product.findMany({
        where: { storeId: store.id },
        select: { name: true, category: true, priceCents: true },
        take: 20,
      });
      if (products.length > 0) {
        productSummary = products.map((p) => `${p.name} (${p.category}, ${p.priceCents}c)`).join(", ");
      }
    }

    // Fetch reference URL content if provided
    let referenceContent: string | undefined;
    if (referenceUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(referenceUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "FlowSmartly-Bot/1.0" },
        });
        clearTimeout(timeout);
        const html = await res.text();
        // Strip HTML tags and collapse whitespace
        referenceContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 8000);
      } catch {
        // Non-critical — continue without reference content
      }
    }

    const themeData = typeof store.theme === "string" ? JSON.parse(store.theme || "{}") : (store.theme || {});
    const settingsData = typeof store.settings === "string" ? JSON.parse(store.settings || "{}") : (store.settings || {});

    const result = await generateStoreEnhancement({
      prompt,
      scope,
      currentStore: {
        name: store.name,
        industry: store.industry,
        theme: themeData as Record<string, unknown>,
        settings: settingsData as Record<string, unknown>,
        productSummary: productSummary || undefined,
      },
      referenceContent,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: { code: "AI_GENERATION_FAILED", message: "AI failed to generate enhancements. Please try again." } },
        { status: 500 }
      );
    }

    // If products were generated, persist them
    let newProductIds: string[] = [];
    if (result.products && result.products.length > 0) {
      newProductIds = await Promise.all(
        result.products.map(async (prod) => {
          const product = await prisma.product.create({
            data: {
              storeId: store.id,
              name: prod.name,
              slug: generateSlug(prod.name),
              description: prod.description,
              shortDescription: prod.shortDescription,
              category: prod.category,
              priceCents: prod.priceCents,
              comparePriceCents: prod.comparePriceCents || null,
              currency: store.currency || "USD",
              tags: JSON.stringify(prod.tags || []),
              status: "DRAFT",
            },
          });

          if (prod.variants && prod.variants.length > 0) {
            await Promise.all(
              prod.variants.map((v) =>
                prisma.productVariant.create({
                  data: {
                    productId: product.id,
                    name: v.name,
                    priceCents: v.priceCents,
                    options: JSON.stringify(v.options),
                  },
                })
              )
            );
          }

          return product.id;
        })
      );
    }

    // If theme changes, update the store theme
    if (result.theme) {
      const currentTheme = { ...themeData } as Record<string, unknown>;
      if (result.theme.colors) {
        currentTheme.colors = { ...((currentTheme.colors as Record<string, string>) || {}), ...result.theme.colors };
      }
      if (result.theme.fonts) {
        currentTheme.fonts = { ...((currentTheme.fonts as Record<string, string>) || {}), ...result.theme.fonts };
      }
      await prisma.store.update({
        where: { id: store.id },
        data: { theme: JSON.stringify(currentTheme) },
      });
    }

    // If content changes, update store settings
    if (result.content) {
      const currentSettings = { ...settingsData } as Record<string, unknown>;
      const currentContent = ((currentSettings.storeContent as Record<string, unknown>) || {});

      if (result.content.tagline) currentContent.tagline = result.content.tagline;
      if (result.content.about) currentContent.about = result.content.about;
      if (result.content.returnPolicy) currentContent.returnPolicy = result.content.returnPolicy;
      if (result.content.shippingPolicy) currentContent.shippingPolicy = result.content.shippingPolicy;
      if (result.content.termsOfService) currentContent.termsOfService = result.content.termsOfService;
      if (result.content.privacyPolicy) currentContent.privacyPolicy = result.content.privacyPolicy;
      if (result.content.faq) currentContent.faq = result.content.faq;

      currentSettings.storeContent = currentContent;

      // Update hero section in sections array
      if (result.content.hero) {
        const sections = (currentSettings.sections as Array<{ id: string; content: Record<string, unknown> }>) || [];
        const heroSection = sections.find((s) => s.id === "hero");
        if (heroSection) {
          if (result.content.hero.headline) heroSection.content.headline = result.content.hero.headline;
          if (result.content.hero.subheadline) heroSection.content.subheadline = result.content.hero.subheadline;
          if (result.content.hero.ctaText) heroSection.content.ctaText = result.content.hero.ctaText;
        }
        currentSettings.sections = sections;
      }

      await prisma.store.update({
        where: { id: store.id },
        data: { settings: JSON.stringify(currentSettings) },
      });
    }

    // Deduct credits
    const cost = await getDynamicCreditCost("AI_STORE_ENHANCE");
    await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: `AI store enhance: ${prompt.slice(0, 50)}`,
      referenceType: "store",
      referenceId: store.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        newProductIds,
      },
    });
  } catch (error: unknown) {
    console.error("AI store enhance error:", error);
    const status = (error as { status?: number }).status;
    if (status === 429 || status === 529) {
      return NextResponse.json(
        { success: false, error: { code: "AI_OVERLOADED", message: "Our AI is experiencing high demand. Please wait a moment and try again." } },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to enhance store. Please try again." } },
      { status: 500 }
    );
  }
}
