import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { searchTrends, getRelatedQueries } from "@/lib/store/trends";

// ── Types ──

export interface MarketResearchResult {
  trendingProducts: {
    name: string;
    category: string;
    demandLevel: "high" | "medium" | "low";
    estimatedPriceRange: string;
    reason: string;
    youHaveIt: boolean;
  }[];
  marketGaps: {
    category: string;
    opportunity: string;
    competitionLevel: "low" | "medium" | "high";
    estimatedDemand: "high" | "medium" | "low";
  }[];
  categoryInsights: {
    category: string;
    trend: "growing" | "stable" | "declining";
    recommendation: string;
  }[];
  actionItems: string[];
  industryOverview: string;
}

// ── POST: Run AI market research ──

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const creditCheck = await checkCreditsForFeature(session.userId, "AI_INTELLIGENCE_RESEARCH");
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 402 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true, name: true, industry: true, currency: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "No store found." } },
        { status: 404 }
      );
    }

    const industry = store.industry || "General Retail";

    // Get current product catalog for comparison
    const products = await prisma.product.findMany({
      where: { storeId: store.id, status: "ACTIVE", deletedAt: null },
      select: { name: true, category: true, priceCents: true },
      take: 50,
    });

    const productList = products.map((p) => `${p.name} (${p.category || "Uncategorized"}, $${(p.priceCents / 100).toFixed(2)})`).join("\n");
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];

    // Fetch real Google Trends data for context
    let trendContext = "";
    try {
      const [trendsData, relatedData] = await Promise.all([
        searchTrends(industry),
        getRelatedQueries(industry),
      ]);

      if (relatedData.top.length > 0) {
        trendContext += `\nTOP GOOGLE SEARCH QUERIES for "${industry}":\n${relatedData.top.slice(0, 10).map((q) => `- ${q.query} (interest: ${q.value})`).join("\n")}`;
      }
      if (relatedData.rising.length > 0) {
        trendContext += `\nRISING GOOGLE SEARCH QUERIES for "${industry}":\n${relatedData.rising.slice(0, 10).map((q) => `- ${q.query} (${q.value})`).join("\n")}`;
      }
      if (trendsData.averageInterest > 0) {
        trendContext += `\nAverage search interest for "${industry}": ${trendsData.averageInterest}/100`;
      }
    } catch {
      // Continue without trend data
    }

    // AI deep market research
    const result = await ai.generateJSON<MarketResearchResult>(
      `You are a market intelligence analyst. Conduct deep research analysis for an e-commerce store.

STORE INDUSTRY: ${industry}
STORE NAME: ${store.name}
CURRENT PRODUCT CATALOG (${products.length} products):
${productList || "No products yet"}

CURRENT CATEGORIES: ${categories.join(", ") || "None"}
${trendContext}

Based on current market trends, consumer demand, and competitive landscape for the "${industry}" industry, provide:

1. **trendingProducts** (8-12): Products that are currently trending and in high demand in this industry. For each, indicate if the store already sells it ("youHaveIt"). Include products the store DOESN'T have that they SHOULD sell. These must be real product types that consumers are actually searching for and buying right now.

2. **marketGaps** (4-6): Categories or product types that are in demand but the store doesn't carry. These are missed opportunities. Be specific about what products would fill the gap.

3. **categoryInsights** (4-6): Analysis of product categories relevant to this industry — whether they're growing, stable, or declining, with specific recommendations.

4. **actionItems** (5-8): Specific, actionable steps the store should take to improve sales and competitiveness. Be concrete (e.g., "Add wireless earbuds to your electronics lineup — search demand grew 40% this quarter").

5. **industryOverview**: A 2-3 sentence overview of the current state of this industry, highlighting key trends and consumer behavior shifts.

Return JSON:
{
  "trendingProducts": [{ "name": "Product Name", "category": "Category", "demandLevel": "high|medium|low", "estimatedPriceRange": "$20-$50", "reason": "Why trending", "youHaveIt": false }],
  "marketGaps": [{ "category": "Category Name", "opportunity": "Description", "competitionLevel": "low|medium|high", "estimatedDemand": "high|medium|low" }],
  "categoryInsights": [{ "category": "Category", "trend": "growing|stable|declining", "recommendation": "What to do" }],
  "actionItems": ["Action 1", "Action 2"],
  "industryOverview": "Overview text"
}

CRITICAL RULES:
- Base your analysis on REAL market trends and consumer behavior in 2024-2025
- Compare against the store's ACTUAL product catalog to identify what they're missing
- Be specific with product names and categories, not generic
- Price estimates should be realistic for the industry
- Rising Google queries indicate REAL consumer demand — use them
- Focus on what the store SHOULD ADD, not what they already have`,
      {
        maxTokens: 4000,
        systemPrompt: "You are an expert e-commerce market intelligence analyst with deep knowledge of consumer trends, retail analytics, and competitive strategy. You provide data-driven, actionable insights based on real market conditions. Return ONLY valid JSON.",
      }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: { code: "AI_FAILED", message: "Failed to generate market research. Please try again." } },
        { status: 500 }
      );
    }

    // Deduct credits
    const cost = await getDynamicCreditCost("AI_INTELLIGENCE_RESEARCH");
    await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: "AI market research analysis",
      referenceType: "store",
      referenceId: store.id,
    });

    return NextResponse.json({
      success: true,
      data: { result, creditsUsed: cost },
    });
  } catch (error: unknown) {
    console.error("Market research API error:", error);
    const status = (error as { status?: number }).status;
    if (status === 429 || status === 529) {
      return NextResponse.json(
        { success: false, error: { code: "AI_OVERLOADED", message: "AI is experiencing high demand. Please wait and try again." } },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to run market research." } },
      { status: 500 }
    );
  }
}
