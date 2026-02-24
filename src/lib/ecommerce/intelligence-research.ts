import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { addCompetitorPrice, analyzePricePosition } from "@/lib/store/competitor-pricing";
import { searchTrends, getRelatedQueries } from "@/lib/store/trends";
import { bulkAnalyzeStoreSEO } from "@/lib/store/seo-optimizer";
import { getTrendingProducts } from "@/lib/store/recommendations";

// ── Types ──

interface CompetitorDiscovery {
  productId: string;
  productName: string;
  competitors: { name: string; priceCents: number; url: string | null; inStock: boolean }[];
}

export interface ResearchResult {
  competitorData: { products: CompetitorDiscovery[] };
  trendData: {
    industry: string;
    timelineData: { date: string; value: number }[];
    relatedQueries: { top: { query: string; value: number }[]; rising: { query: string; value: number }[] };
  } | null;
  seoData: {
    products: { productId: string; name: string; score: number; issueCount: number; hasSeoTitle: boolean; hasSeoDescription: boolean }[];
    averageScore: number;
  } | null;
  recommendationData: { trending: unknown[] } | null;
  summary: {
    competitorsFound: number;
    avgSeoScore: number;
    trendHighlights: string[];
    topRecommendations: string[];
  };
}

// ── Main Pipeline ──

export async function runIntelligenceResearch(storeId: string): Promise<ResearchResult> {
  // Load store info
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { name: true, industry: true, currency: true },
  });

  // ═══════════════════════════════════════════════════════════════
  // Phase 1 — Competitor Discovery
  // ═══════════════════════════════════════════════════════════════

  const products = await prisma.product.findMany({
    where: { storeId, status: "ACTIVE" },
    select: { id: true, name: true, category: true, priceCents: true, currency: true },
    take: 20,
  });

  const competitorResults: CompetitorDiscovery[] = [];

  for (const product of products) {
    try {
      // Check existing competitor count
      const existingCount = await prisma.competitorPrice.count({
        where: { productId: product.id },
      });

      const discoveredCompetitors: CompetitorDiscovery["competitors"] = [];

      if (existingCount < 3) {
        const aiResult = await ai.generateJSON<{
          competitors: { name: string; estimatedPriceCents: number; url: string | null; inStock: boolean }[];
        }>(
          `Find competitors for this product and estimate their pricing.

PRODUCT: ${product.name}
CATEGORY: ${product.category || "General"}
INDUSTRY: ${store.industry || "Retail"}
MY PRICE: $${(product.priceCents / 100).toFixed(2)} ${product.currency}

Return JSON: {
  "competitors": [
    { "name": "Competitor Store Name", "estimatedPriceCents": 1999, "url": null, "inStock": true }
  ]
}

Rules:
- Return 3-5 realistic competitors based on the product type and industry
- Estimate prices realistically based on the product category and typical market prices
- Use well-known retailers or common competitor names for this product category
- Price estimates should be in cents (integer)`,
          {
            maxTokens: 1024,
            systemPrompt: "You are an expert competitive intelligence analyst for e-commerce. Return ONLY valid JSON.",
          }
        );

        if (aiResult?.competitors) {
          for (const comp of aiResult.competitors) {
            try {
              await addCompetitorPrice(storeId, {
                productId: product.id,
                competitorName: comp.name,
                priceCents: comp.estimatedPriceCents,
                competitorUrl: comp.url || undefined,
                inStock: comp.inStock ?? true,
              });
              discoveredCompetitors.push({
                name: comp.name,
                priceCents: comp.estimatedPriceCents,
                url: comp.url,
                inStock: comp.inStock ?? true,
              });
            } catch {
              // Skip duplicates / errors
            }
          }
        }
      }

      competitorResults.push({
        productId: product.id,
        productName: product.name,
        competitors: discoveredCompetitors,
      });

      // Delay between products
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      // Skip product on error
      competitorResults.push({
        productId: product.id,
        productName: product.name,
        competitors: [],
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 2 — Trends
  // ═══════════════════════════════════════════════════════════════

  let trendData: ResearchResult["trendData"] = null;

  if (store.industry) {
    try {
      const trendsResult = await searchTrends(store.industry);
      const relatedResult = await getRelatedQueries(store.industry);

      trendData = {
        industry: store.industry,
        timelineData: trendsResult?.timelineData || [],
        relatedQueries: relatedResult || { top: [], rising: [] },
      };
    } catch {
      trendData = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 3 — SEO
  // ═══════════════════════════════════════════════════════════════

  let seoData: ResearchResult["seoData"] = null;

  try {
    const seoResults = await bulkAnalyzeStoreSEO(storeId);

    const seoProducts = seoResults.map((p) => ({
      productId: p.productId,
      name: p.name,
      score: p.score,
      issueCount: p.issueCount,
      hasSeoTitle: p.hasSeoTitle,
      hasSeoDescription: p.hasSeoDescription,
    }));

    const averageScore =
      seoProducts.length > 0
        ? Math.round(seoProducts.reduce((acc, p) => acc + p.score, 0) / seoProducts.length)
        : 0;

    seoData = { products: seoProducts, averageScore };
  } catch {
    seoData = null;
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 4 — Recommendations
  // ═══════════════════════════════════════════════════════════════

  let recommendationData: ResearchResult["recommendationData"] = null;

  try {
    const trendingProducts = await getTrendingProducts(storeId, 10);
    recommendationData = { trending: trendingProducts };
  } catch {
    recommendationData = null;
  }

  // ═══════════════════════════════════════════════════════════════
  // Summary Generation
  // ═══════════════════════════════════════════════════════════════

  const totalCompetitors = competitorResults.reduce((acc, cr) => acc + cr.competitors.length, 0);
  const avgSeoScore = seoData?.averageScore ?? 0;

  let summary: ResearchResult["summary"] = {
    competitorsFound: totalCompetitors,
    avgSeoScore,
    trendHighlights: [],
    topRecommendations: [],
  };

  try {
    const aiSummary = await ai.generateJSON<{
      competitorsFound: number;
      avgSeoScore: number;
      trendHighlights: string[];
      topRecommendations: string[];
    }>(
      `Based on this intelligence research data, provide a brief summary.

Competitors found: ${totalCompetitors} across ${competitorResults.length} products
Average SEO score: ${avgSeoScore}/100
Industry: ${store.industry}
${trendData ? `Trend data available for ${store.industry}` : "No trend data"}

Return JSON: {
  "competitorsFound": ${totalCompetitors},
  "avgSeoScore": ${avgSeoScore},
  "trendHighlights": ["highlight 1", "highlight 2", "highlight 3"],
  "topRecommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}

Make the highlights and recommendations specific, actionable, and based on the data. Keep each to 1 sentence.`,
      {
        maxTokens: 1024,
        systemPrompt: "You are an expert e-commerce intelligence analyst. Return ONLY valid JSON.",
      }
    );

    if (aiSummary) {
      summary = aiSummary;
    }
  } catch {
    // Keep default summary on AI failure
  }

  return {
    competitorData: { products: competitorResults },
    trendData,
    seoData,
    recommendationData,
    summary,
  };
}
