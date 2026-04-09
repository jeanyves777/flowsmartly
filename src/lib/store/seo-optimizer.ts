import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts/index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SEOIssue {
  type: "error" | "warning" | "info";
  message: string;
}

interface SEOAnalysis {
  score: number; // 0-100
  issues: SEOIssue[];
  suggestions: string[];
}

interface SEOOptimizationResult {
  seoTitle: string;
  seoDescription: string;
  score: number;
  improvements: string[];
}

interface ProductSEOSummary {
  productId: string;
  name: string;
  score: number;
  issueCount: number;
  hasSeoTitle: boolean;
  hasSeoDescription: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 1. Heuristic SEO analysis (free, synchronous)
// ---------------------------------------------------------------------------

export function analyzeProductSEO(product: {
  name: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  description?: string | null;
}): SEOAnalysis {
  let score = 100;
  const issues: SEOIssue[] = [];
  const suggestions: string[] = [];

  // --- SEO title checks ---
  if (!product.seoTitle) {
    score -= 25;
    issues.push({ type: "error", message: "Missing SEO title" });
    suggestions.push("Add an SEO title with your primary keyword");
  } else {
    if (product.seoTitle.length > 60) {
      score -= 10;
      issues.push({
        type: "warning",
        message: `SEO title is too long (${product.seoTitle.length} chars, max 60)`,
      });
      suggestions.push("Shorten your SEO title to 60 characters or fewer");
    }

    if (product.seoTitle.length < 30) {
      score -= 5;
      issues.push({
        type: "warning",
        message: `SEO title is too short (${product.seoTitle.length} chars, min 30)`,
      });
      suggestions.push(
        "Expand your SEO title to at least 30 characters for better visibility"
      );
    }

    // Check if the first word of the product name appears in the SEO title
    const firstWord = product.name.split(/\s+/)[0]?.toLowerCase();
    if (
      firstWord &&
      !product.seoTitle.toLowerCase().includes(firstWord)
    ) {
      score -= 5;
      issues.push({
        type: "info",
        message: `Product name keyword "${firstWord}" not found in SEO title`,
      });
      suggestions.push(
        "Include your product name or its primary keyword in the SEO title"
      );
    }
  }

  // --- SEO description checks ---
  if (!product.seoDescription) {
    score -= 25;
    issues.push({ type: "error", message: "Missing SEO description" });
    suggestions.push(
      "Add an SEO meta description to improve click-through rates from search results"
    );
  } else {
    if (product.seoDescription.length > 155) {
      score -= 10;
      issues.push({
        type: "warning",
        message: `SEO description is too long (${product.seoDescription.length} chars, max 155)`,
      });
      suggestions.push("Trim your SEO description to 155 characters or fewer");
    }

    if (product.seoDescription.length < 70) {
      score -= 5;
      issues.push({
        type: "warning",
        message: `SEO description is too short (${product.seoDescription.length} chars, min 70)`,
      });
      suggestions.push(
        "Expand your SEO description to at least 70 characters with a clear call-to-action"
      );
    }
  }

  // --- Product description check ---
  if (!product.description) {
    score -= 10;
    issues.push({
      type: "warning",
      message: "Product has no description for search engines to index",
    });
    suggestions.push(
      "Add a detailed product description to help search engines understand and rank your product"
    );
  }

  score = Math.max(0, score);

  return { score, issues, suggestions };
}

// ---------------------------------------------------------------------------
// 2. AI-powered SEO optimization (costs credits)
// ---------------------------------------------------------------------------

export async function optimizeProductSEO(
  productId: string
): Promise<SEOOptimizationResult | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      description: true,
      shortDescription: true,
      seoTitle: true,
      seoDescription: true,
      category: true,
      tags: true,
    },
  });

  if (!product) return null;

  // Parse tags — stored as a JSON string array
  let parsedTags: string[] = [];
  if (product.tags) {
    try {
      parsedTags = JSON.parse(product.tags as string);
    } catch {
      // Ignore malformed tags
    }
  }

  const prompt = `Generate SEO-optimized title and meta description for this e-commerce product.

Product Name: ${product.name}
Category: ${product.category || "General"}
Description: ${product.description?.slice(0, 500) || "None"}
Keywords: ${parsedTags.length > 0 ? parsedTags.join(", ") : "None"}
Current SEO Title: ${product.seoTitle || "None"}
Current SEO Description: ${product.seoDescription || "None"}

Requirements:
- SEO title: 30-60 characters, include primary keyword, compelling for clicks
- SEO description: 70-155 characters, include call-to-action, naturally include keywords
- Optimize for search intent relevant to this product category

Return JSON: { "seoTitle": "...", "seoDescription": "...", "score": <0-100>, "improvements": ["..."] }`;

  const result = await ai.generateJSON<SEOOptimizationResult>(prompt, {
    systemPrompt: SYSTEM_PROMPTS.seoOptimizer,
    maxTokens: 512,
  });

  if (result) {
    await prisma.product.update({
      where: { id: productId },
      data: {
        seoTitle: result.seoTitle,
        seoDescription: result.seoDescription,
      },
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// 3. Bulk heuristic analysis for all products in a store
// ---------------------------------------------------------------------------

export async function bulkAnalyzeStoreSEO(
  storeId: string
): Promise<ProductSEOSummary[]> {
  const products = await prisma.product.findMany({
    where: {
      storeId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      seoTitle: true,
      seoDescription: true,
      description: true,
    },
  });

  const summaries: ProductSEOSummary[] = products.map((product) => {
    const analysis = analyzeProductSEO(product);

    return {
      productId: product.id,
      name: product.name,
      score: analysis.score,
      issueCount: analysis.issues.length,
      hasSeoTitle: !!product.seoTitle,
      hasSeoDescription: !!product.seoDescription,
    };
  });

  // Sort by score ascending — worst scores first
  summaries.sort((a, b) => a.score - b.score);

  return summaries;
}

// ---------------------------------------------------------------------------
// 4. Bulk AI optimization for multiple products (sequential)
// ---------------------------------------------------------------------------

export async function bulkOptimizeProductSEO(
  productIds: string[]
): Promise<{ productId: string; result: SEOOptimizationResult | null }[]> {
  const results: { productId: string; result: SEOOptimizationResult | null }[] =
    [];

  for (let i = 0; i < productIds.length; i++) {
    const productId = productIds[i];
    const result = await optimizeProductSEO(productId);
    results.push({ productId, result });

    // Small delay between calls to avoid rate limiting
    if (i < productIds.length - 1) {
      await delay(500);
    }
  }

  return results;
}
