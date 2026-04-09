import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { runStoreAgent, type ProductInput } from "@/lib/store-builder/store-agent";
import { searchProductImages } from "@/lib/store-builder/image-search";

/**
 * POST /api/ecommerce/store/[id]/migrate — Migrate V1 store to V2
 *
 * Collects existing products, images, categories, and store info from the DB,
 * then runs the V2 agent to rebuild the store as a static site.
 *
 * This preserves all existing data while giving the store a modern design.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    // Fetch full store with products and categories
    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      include: {
        products: {
          where: { status: { not: "ARCHIVED" } },
          include: { productCategory: true },
          orderBy: { createdAt: "asc" },
        },
        categories: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Already V2 — no migration needed
    if (store.generatorVersion === "v2") {
      return NextResponse.json({ error: "Store is already V2", alreadyMigrated: true }, { status: 400 });
    }

    // Check credits
    const cost = await getDynamicCreditCost("AI_STORE_GENERATE");
    const check = await checkCreditsForFeature(session.userId, "AI_STORE_GENERATE");
    if (check) {
      return NextResponse.json({ error: check.message, required: cost }, { status: 402 });
    }

    // Collect existing products with their images
    const productInputs: ProductInput[] = store.products.map((p) => {
      let images: string[] = [];
      try {
        const parsed = JSON.parse(p.images || "[]");
        if (Array.isArray(parsed)) {
          images = parsed.map((img: any) => (typeof img === "string" ? img : img.url)).filter(Boolean);
        }
      } catch {}

      let variants: ProductInput["variants"] = [];
      // Fetch variants from the DB (they're in a separate table)
      // We'll do this async below

      let tags: string[] = [];
      try {
        tags = JSON.parse(p.tags || "[]");
      } catch {}

      return {
        name: p.name,
        description: p.description || p.shortDescription || "",
        priceCents: p.priceCents,
        comparePriceCents: p.comparePriceCents || undefined,
        category: p.productCategory?.name || "",
        images,
        variants: [],
        tags,
      };
    });

    // Fetch variants for each product
    const productIds = store.products.map(p => p.id);
    const allVariants = await prisma.productVariant.findMany({
      where: { productId: { in: productIds }, isActive: true },
    });

    // Map variants to their products
    for (let i = 0; i < store.products.length; i++) {
      const prodId = store.products[i].id;
      const prodVariants = allVariants.filter(v => v.productId === prodId);
      productInputs[i].variants = prodVariants.map(v => {
        let options: Record<string, string> = {};
        try { options = JSON.parse(v.options || "{}"); } catch {}
        return {
          name: v.name,
          options,
          priceCents: v.priceCents,
        };
      });
    }

    // Collect categories
    const categoryNames = store.categories.map(c => c.name);

    // Auto-search images for products that have none
    for (let i = 0; i < productInputs.length; i++) {
      if (productInputs[i].images.length === 0) {
        try {
          const results = await searchProductImages(productInputs[i].name, 1);
          if (results.length > 0) {
            productInputs[i].images = [results[0].url];
          }
        } catch {}
      }
    }

    const productsWithImages = productInputs.filter(p => p.images.length > 0).length;
    console.log(
      `[StoreMigrate] Starting V1→V2 migration for store ${id} (${store.name}): ` +
      `${productInputs.length} products (${productsWithImages} with images), ${categoryNames.length} categories`
    );

    // Run V2 agent in background
    const agentPromise = runStoreAgent(
      id,
      store.slug,
      session.userId,
      {
        name: store.name,
        industry: store.industry || undefined,
        region: store.region || undefined,
        currency: store.currency,
      },
      productInputs,
      categoryNames,
      (progress) => {
        console.log(
          `[StoreMigrate] ${progress.step}${progress.detail ? ` — ${progress.detail}` : ""} (${progress.toolCalls} calls)`
        );
      }
    );

    // Fire-and-forget
    agentPromise
      .then(async (result) => {
        if (result.success) {
          await creditService.deductCredits({
            userId: session.userId,
            amount: cost,
            type: TRANSACTION_TYPES.USAGE,
            description: `Store migration V1→V2: ${store.name}`,
          });
          console.log(`[StoreMigrate] Store ${id} migrated successfully, ${cost} credits deducted`);
        } else {
          console.error(`[StoreMigrate] Store ${id} migration failed: ${result.error}`);
        }
      })
      .catch((err) => {
        console.error(`[StoreMigrate] Store ${id} fatal error:`, err);
      });

    return NextResponse.json({
      success: true,
      message: "Migration started",
      productsCollected: productInputs.length,
      categoriesCollected: categoryNames.length,
    });
  } catch (err) {
    console.error("POST /api/ecommerce/store/[id]/migrate error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * GET /api/ecommerce/store/[id]/migrate — Get migration eligibility info
 *
 * Returns whether a store can be migrated and what data would be collected.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        generatorVersion: true,
        buildStatus: true,
        _count: {
          select: {
            products: { where: { status: { not: "ARCHIVED" } } },
            categories: true,
            orders: true,
          },
        },
      },
    });

    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const cost = await getDynamicCreditCost("AI_STORE_GENERATE");

    return NextResponse.json({
      eligible: store.generatorVersion === "v1",
      alreadyMigrated: store.generatorVersion === "v2",
      buildStatus: store.buildStatus,
      productCount: store._count.products,
      categoryCount: store._count.categories,
      orderCount: store._count.orders,
      creditCost: cost,
    });
  } catch (err) {
    console.error("GET /api/ecommerce/store/[id]/migrate error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
