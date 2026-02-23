import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { z } from "zod";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { analyzeProductSEO, optimizeProductSEO, bulkAnalyzeStoreSEO, bulkOptimizeProductSEO } from "@/lib/store/seo-optimizer";

// ── GET /api/ecommerce/intelligence/seo ──────────────────────────────────────
// Free heuristic SEO analysis (no credits required)

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const action = searchParams.get("action");

    if (productId) {
      // Validate product belongs to this store
      const product = await prisma.product.findFirst({
        where: { id: productId, storeId: store.id },
        select: { name: true, seoTitle: true, seoDescription: true, description: true },
      });

      if (!product) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
          { status: 404 }
        );
      }

      const analysis = analyzeProductSEO(product);

      return NextResponse.json({
        success: true,
        data: { analysis },
      });
    }

    if (action === "bulk_analyze") {
      const products = await bulkAnalyzeStoreSEO(store.id);

      return NextResponse.json({
        success: true,
        data: { products },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Missing productId or action=bulk_analyze" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("SEO analysis error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to analyze SEO" } },
      { status: 500 }
    );
  }
}

// ── POST /api/ecommerce/intelligence/seo ─────────────────────────────────────
// AI-powered SEO optimization (costs credits)

const optimizeSchema = z.object({
  productId: z.string().min(1),
  action: z.literal("optimize"),
});

const bulkOptimizeSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(50),
  action: z.literal("bulk_optimize"),
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

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const action = body?.action;

    // ── Single product optimization ──

    if (action === "optimize") {
      const parsed = optimizeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
          { status: 400 }
        );
      }

      // Validate product belongs to this store
      const product = await prisma.product.findFirst({
        where: { id: parsed.data.productId, storeId: store.id },
        select: { id: true },
      });

      if (!product) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
          { status: 404 }
        );
      }

      // Credit check
      const creditCheck = await checkCreditsForFeature(session.userId, "AI_SEO_OPTIMIZE");
      if (creditCheck) {
        return NextResponse.json(
          { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
          { status: 402 }
        );
      }

      // Optimize
      const result = await optimizeProductSEO(parsed.data.productId);
      if (!result) {
        return NextResponse.json(
          { success: false, error: { code: "OPTIMIZATION_FAILED", message: "Failed to optimize product SEO" } },
          { status: 500 }
        );
      }

      // Deduct credits
      const cost = await getDynamicCreditCost("AI_SEO_OPTIMIZE");
      await creditService.deductCredits({
        userId: session.userId,
        amount: cost,
        type: TRANSACTION_TYPES.USAGE,
        description: "AI SEO optimization",
        referenceType: "product",
        referenceId: parsed.data.productId,
      });

      return NextResponse.json({
        success: true,
        data: { result, creditsUsed: cost },
      });
    }

    // ── Bulk product optimization ──

    if (action === "bulk_optimize") {
      const parsed = bulkOptimizeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
          { status: 400 }
        );
      }

      // Validate ALL products belong to this store
      const products = await prisma.product.findMany({
        where: { id: { in: parsed.data.productIds }, storeId: store.id },
        select: { id: true },
      });

      const foundIds = new Set(products.map((p) => p.id));
      const missingIds = parsed.data.productIds.filter((id) => !foundIds.has(id));

      if (missingIds.length > 0) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: `Products not found: ${missingIds.join(", ")}` } },
          { status: 404 }
        );
      }

      // Calculate total cost and check credits
      const costPerProduct = await getDynamicCreditCost("AI_SEO_OPTIMIZE");
      const totalCost = parsed.data.productIds.length * costPerProduct;

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true, freeCredits: true },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: { code: "INSUFFICIENT_CREDITS", message: "User not found" } },
          { status: 402 }
        );
      }

      // AI features can't use free credits — check purchased credits only
      const purchasedCredits = Math.max(0, user.aiCredits - (user.freeCredits || 0));
      if (purchasedCredits < totalCost) {
        if ((user.freeCredits || 0) > 0 && user.aiCredits >= totalCost) {
          return NextResponse.json(
            { success: false, error: { code: "FREE_CREDITS_RESTRICTED", message: `Your free credits can only be used for email marketing. Purchase credits to use this feature (${totalCost} credits required for ${parsed.data.productIds.length} products).` } },
            { status: 402 }
          );
        }
        return NextResponse.json(
          { success: false, error: { code: "INSUFFICIENT_CREDITS", message: `Bulk optimization requires ${totalCost} credits (${costPerProduct} per product x ${parsed.data.productIds.length}). You have ${purchasedCredits} purchased credits remaining.` } },
          { status: 402 }
        );
      }

      // Run bulk optimization
      const results = await bulkOptimizeProductSEO(parsed.data.productIds);

      // Count successes and deduct credits only for those
      const successCount = results.filter((r) => r.result !== null).length;
      const totalCreditsUsed = successCount * costPerProduct;

      if (totalCreditsUsed > 0) {
        await creditService.deductCredits({
          userId: session.userId,
          amount: totalCreditsUsed,
          type: TRANSACTION_TYPES.USAGE,
          description: `AI SEO bulk optimization (${successCount} products)`,
          referenceType: "product",
        });
      }

      return NextResponse.json({
        success: true,
        data: { results, totalCreditsUsed },
      });
    }

    // ── Unknown action ──

    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid action. Use 'optimize' or 'bulk_optimize'" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("SEO optimization error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to optimize SEO" } },
      { status: 500 }
    );
  }
}
