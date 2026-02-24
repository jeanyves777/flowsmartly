import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { generateSlug } from "@/lib/constants/ecommerce";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { z } from "zod";

// ── Validation ──

const generateProductsSchema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters").max(2000),
  count: z.number().int().min(1).max(20),
});

// ── Types ──

interface ProductBlueprint {
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  priceCents: number;
  comparePriceCents: number | null;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  variants: {
    name: string;
    priceCents: number;
    comparePriceCents?: number;
    options: Record<string, string>;
  }[];
}

// ── POST /api/ecommerce/ai/generate-products ──

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

    // Parse and validate body
    const body = await request.json();
    const parsed = generateProductsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { description, count } = parsed.data;

    // Credit check: cost = count * AI_BULK_PRODUCTS per product
    const perProductCost = await getDynamicCreditCost("AI_BULK_PRODUCTS");
    const totalCost = perProductCost * count;

    const creditCheck = await checkCreditsForFeature(
      session.userId,
      "AI_BULK_PRODUCTS",
      !!session.adminId
    );

    if (creditCheck) {
      // checkCreditsForFeature checks for single-unit cost; we need to verify total cost
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true, freeCredits: true },
      });

      const purchasedCredits = Math.max(0, (user?.aiCredits || 0) - (user?.freeCredits || 0));
      if (purchasedCredits < totalCost && !session.adminId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: creditCheck.code,
              message: `Generating ${count} products requires ${totalCost} credits (${perProductCost} per product). You have ${purchasedCredits} purchased credits remaining.`,
            },
          },
          { status: 403 }
        );
      }
    }

    // Get user's store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        name: true,
        industry: true,
        currency: true,
        description: true,
      },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "Store not found. Please set up your store first." } },
        { status: 404 }
      );
    }

    // Get existing categories for context
    const existingCategories = await prisma.productCategory.findMany({
      where: { storeId: store.id },
      select: { id: true, name: true, slug: true },
    });

    // Get existing product names for dedup
    const existingProducts = await prisma.product.findMany({
      where: { storeId: store.id, deletedAt: null },
      select: { name: true },
    });

    const existingProductNames = existingProducts.map((p) => p.name);
    const existingCategoryNames = existingCategories.map((c) => c.name);

    // Build AI prompt
    const prompt = `Generate exactly ${count} unique product listings for an online store.

STORE CONTEXT:
- Store Name: ${store.name}
- Industry: ${store.industry || "General"}
- Currency: ${store.currency || "USD"}
- Store Description: ${store.description || "N/A"}

NICHE / PRODUCT DESCRIPTION:
${description}

EXISTING CATEGORIES (reuse these when appropriate, or suggest new ones):
${existingCategoryNames.length > 0 ? existingCategoryNames.join(", ") : "None yet"}

EXISTING PRODUCT NAMES (do NOT duplicate these):
${existingProductNames.length > 0 ? existingProductNames.join(", ") : "None yet"}

For each product, generate:
- name: Unique, compelling product name (max 100 chars)
- description: Rich product description (2-3 paragraphs, benefit-driven, engaging)
- shortDescription: Brief summary (max 155 chars)
- category: Category name (reuse existing ones when they fit, or create new descriptive ones)
- priceCents: Realistic price in cents (e.g., 2999 = $29.99). Use realistic market pricing.
- comparePriceCents: Optional "was" price in cents (higher than priceCents, or null). Use for 20-40% of products.
- seoTitle: SEO-optimized title (max 60 chars)
- seoDescription: SEO meta description (max 155 chars, include call-to-action)
- tags: Array of 3-6 relevant tags (lowercase, no hashtags)
- variants: Array of 1-3 product variants, each with:
  - name: Variant name (e.g., "Small", "Medium / Blue")
  - priceCents: Variant-specific price in cents
  - comparePriceCents: Optional compare price (or omit)
  - options: Object with option key-value pairs (e.g., {"size": "S", "color": "Blue"})

IMPORTANT:
- Each product must be unique and different from existing products
- Prices should be realistic for the niche and market
- Descriptions should be benefit-driven and conversion-optimized
- All names, descriptions, and SEO content must be original
- Variants should make sense for the product type (sizes, colors, bundles, etc.)
- Return a JSON array of ${count} product objects

Return ONLY a valid JSON array of product objects.`;

    // Call AI
    const result = await ai.generateJSON<ProductBlueprint[]>(prompt, {
      maxTokens: 6000,
      systemPrompt: SYSTEM_PROMPTS.ecommerceContent,
    });

    if (!result || !Array.isArray(result) || result.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "AI_ERROR", message: "Failed to generate products. Please try again." } },
        { status: 500 }
      );
    }

    // Limit to requested count
    const blueprints = result.slice(0, count);

    // Create products in database
    const createdProducts = [];

    for (const blueprint of blueprints) {
      try {
        // Find or create category
        let categoryId: string | null = null;
        if (blueprint.category) {
          const existingCat = existingCategories.find(
            (c) => c.name.toLowerCase() === blueprint.category.toLowerCase()
          );

          if (existingCat) {
            categoryId = existingCat.id;
          } else {
            // Create new category
            const catSlug = generateSlug(blueprint.category);
            let finalCatSlug = catSlug;
            let catSuffix = 1;
            while (true) {
              const existing = await prisma.productCategory.findUnique({
                where: { storeId_slug: { storeId: store.id, slug: finalCatSlug } },
                select: { id: true },
              });
              if (!existing) break;
              catSuffix++;
              finalCatSlug = `${catSlug}-${catSuffix}`;
            }

            const newCat = await prisma.productCategory.create({
              data: {
                storeId: store.id,
                name: blueprint.category,
                slug: finalCatSlug,
              },
            });
            categoryId = newCat.id;

            // Add to local cache to avoid re-creating
            existingCategories.push({
              id: newCat.id,
              name: newCat.name,
              slug: newCat.slug,
            });
          }
        }

        // Generate unique slug
        let slug = generateSlug(blueprint.name);
        let slugSuffix = 1;
        while (true) {
          const existing = await prisma.product.findUnique({
            where: { storeId_slug: { storeId: store.id, slug } },
            select: { id: true },
          });
          if (!existing) break;
          slugSuffix++;
          slug = `${generateSlug(blueprint.name)}-${slugSuffix}`;
        }

        // Create product + variants in a transaction
        const product = await prisma.$transaction(async (tx) => {
          const created = await tx.product.create({
            data: {
              storeId: store.id,
              name: blueprint.name,
              slug,
              description: blueprint.description,
              shortDescription: blueprint.shortDescription || null,
              category: blueprint.category || null,
              categoryId,
              tags: JSON.stringify(blueprint.tags || []),
              priceCents: blueprint.priceCents,
              comparePriceCents: blueprint.comparePriceCents || null,
              images: JSON.stringify([]),
              status: "DRAFT",
              seoTitle: blueprint.seoTitle || null,
              seoDescription: blueprint.seoDescription || null,
            },
          });

          // Create variants
          if (blueprint.variants && blueprint.variants.length > 0) {
            await tx.productVariant.createMany({
              data: blueprint.variants.map((v) => ({
                productId: created.id,
                name: v.name,
                priceCents: v.priceCents,
                comparePriceCents: v.comparePriceCents || null,
                options: JSON.stringify(v.options || {}),
                quantity: 0,
              })),
            });
          }

          // Increment store product count
          await tx.store.update({
            where: { id: store.id },
            data: { productCount: { increment: 1 } },
          });

          return tx.product.findUnique({
            where: { id: created.id },
            include: {
              variants: true,
              productCategory: { select: { id: true, name: true } },
            },
          });
        });

        if (product) {
          createdProducts.push({
            ...product,
            images: JSON.parse(product.images || "[]"),
            tags: JSON.parse(product.tags || "[]"),
          });
        }
      } catch (err) {
        console.error(`Failed to create product "${blueprint.name}":`, err);
        // Continue with remaining products
      }
    }

    if (createdProducts.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "CREATE_ERROR", message: "Failed to create any products. Please try again." } },
        { status: 500 }
      );
    }

    // Deduct credits based on actually created products
    const actualCost = createdProducts.length * perProductCost;
    await creditService.deductCredits({
      userId: session.userId,
      amount: actualCost,
      type: TRANSACTION_TYPES.USAGE,
      description: `AI bulk product generation (${createdProducts.length} products)`,
      referenceType: "product",
      referenceId: store.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        products: createdProducts,
        count: createdProducts.length,
        creditsUsed: actualCost,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("AI generate products error:", error);

    const status = (error as { status?: number }).status;
    if (status === 429 || status === 529) {
      return NextResponse.json(
        { success: false, error: { code: "AI_OVERLOADED", message: "Our AI is experiencing high demand. Please wait a moment and try again." } },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to generate products. Please try again." } },
      { status: 500 }
    );
  }
}
