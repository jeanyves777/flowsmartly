import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { z } from "zod";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getAIPricingSuggestion, savePricingRule, getPricingRule, applyPricingRules } from "@/lib/store/dynamic-pricing";
import { analyzePricePosition, getPriceHistory, recordPriceChange } from "@/lib/store/competitor-pricing";

// ── POST Schemas ──

const saveRuleSchema = z.object({
  productId: z.string().min(1),
  action: z.literal("save_rule"),
  strategy: z.enum(["beat_lowest", "match_average", "premium", "demand", "margin_target"]),
  config: z.object({
    marginPercent: z.number().optional(),
    offsetCents: z.number().optional(),
    minPriceCents: z.number().int().positive().optional(),
    maxPriceCents: z.number().int().positive().optional(),
    roundTo: z.number().int().min(0).max(99).optional(),
  }).optional(),
});

const applyPriceSchema = z.object({
  productId: z.string().min(1),
  action: z.literal("apply_price"),
  priceCents: z.number().int().positive(),
  source: z.string().optional().default("manual"),
  reason: z.string().optional(),
});

const applyRulesSchema = z.object({
  action: z.literal("apply_rules"),
});

// ── GET /api/ecommerce/intelligence/pricing ──

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
    const action = searchParams.get("action");
    const productId = searchParams.get("productId");

    switch (action) {
      case "suggest": {
        if (!productId) {
          return NextResponse.json(
            { success: false, error: { code: "MISSING_PRODUCT", message: "productId is required" } },
            { status: 400 }
          );
        }

        // Validate product belongs to store
        const product = await prisma.product.findFirst({
          where: { id: productId, storeId: store.id },
          select: { id: true },
        });
        if (!product) {
          return NextResponse.json(
            { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
            { status: 404 }
          );
        }

        // Check credits
        const creditCheck = await checkCreditsForFeature(session.userId, "AI_DYNAMIC_PRICING");
        if (creditCheck) {
          return NextResponse.json(
            { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
            { status: 402 }
          );
        }

        // Get AI suggestion
        const suggestion = await getAIPricingSuggestion(productId);
        if (!suggestion) {
          return NextResponse.json(
            { success: false, error: { code: "SUGGESTION_FAILED", message: "Failed to generate pricing suggestion" } },
            { status: 500 }
          );
        }

        // Deduct credits
        const cost = await getDynamicCreditCost("AI_DYNAMIC_PRICING");
        await creditService.deductCredits({
          userId: session.userId,
          amount: cost,
          type: TRANSACTION_TYPES.USAGE,
          description: "AI dynamic pricing suggestion",
          referenceType: "product",
          referenceId: productId,
        });

        return NextResponse.json({
          success: true,
          data: { suggestion, creditsUsed: cost },
        });
      }

      case "rule": {
        if (!productId) {
          return NextResponse.json(
            { success: false, error: { code: "MISSING_PRODUCT", message: "productId is required" } },
            { status: 400 }
          );
        }

        const rule = await getPricingRule(productId);
        return NextResponse.json({ success: true, data: { rule } });
      }

      case "analysis": {
        if (!productId) {
          return NextResponse.json(
            { success: false, error: { code: "MISSING_PRODUCT", message: "productId is required" } },
            { status: 400 }
          );
        }

        const analysis = await analyzePricePosition(productId);
        return NextResponse.json({ success: true, data: { analysis } });
      }

      case "history": {
        if (!productId) {
          return NextResponse.json(
            { success: false, error: { code: "MISSING_PRODUCT", message: "productId is required" } },
            { status: 400 }
          );
        }

        const days = parseInt(searchParams.get("days") || "90", 10);
        const history = await getPriceHistory(productId, days);
        return NextResponse.json({ success: true, data: { history } });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: "INVALID_ACTION", message: "Invalid action" } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Pricing intelligence GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch pricing data" } },
      { status: 500 }
    );
  }
}

// ── POST /api/ecommerce/intelligence/pricing ──

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
    const action = body.action;

    switch (action) {
      case "save_rule": {
        const parsed = saveRuleSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
            { status: 400 }
          );
        }

        const { productId, strategy, config } = parsed.data;

        // Validate product belongs to store
        const product = await prisma.product.findFirst({
          where: { id: productId, storeId: store.id },
          select: { id: true },
        });
        if (!product) {
          return NextResponse.json(
            { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
            { status: 404 }
          );
        }

        const rule = await savePricingRule(productId, strategy, config || {});
        return NextResponse.json({ success: true, data: { rule } });
      }

      case "apply_price": {
        const parsed = applyPriceSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
            { status: 400 }
          );
        }

        const { productId, priceCents, source, reason } = parsed.data;

        // Validate product belongs to store
        const product = await prisma.product.findFirst({
          where: { id: productId, storeId: store.id },
          select: { id: true },
        });
        if (!product) {
          return NextResponse.json(
            { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
            { status: 404 }
          );
        }

        // Update product price
        const updatedProduct = await prisma.product.update({
          where: { id: productId },
          data: { priceCents },
        });

        // Record the price change
        await recordPriceChange(productId, priceCents, source, reason);

        return NextResponse.json({ success: true, data: { product: updatedProduct } });
      }

      case "apply_rules": {
        const parsed = applyRulesSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
            { status: 400 }
          );
        }

        const result = await applyPricingRules(store.id);
        return NextResponse.json({ success: true, data: result });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: "INVALID_ACTION", message: "Invalid action" } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Pricing intelligence POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to process pricing action" } },
      { status: 500 }
    );
  }
}
