import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";
import { ai } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";

const requestSchema = z.object({
  url: z.string().url(),
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

    const creditCheck = await checkCreditsForFeature(session.userId, "AI_SITE_SCRAPE");
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
        { success: false, error: { code: "VALIDATION_ERROR", message: "Please provide a valid URL" } },
        { status: 400 }
      );
    }

    const { url } = parsed.data;

    // Fetch the page
    let htmlContent: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "FlowSmartly-Bot/1.0 (site analysis)" },
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      htmlContent = await res.text();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "FETCH_FAILED", message: "Could not reach the website. Please check the URL and try again." } },
        { status: 422 }
      );
    }

    // Extract text content from HTML
    const textContent = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#?\w+;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000);

    if (textContent.length < 50) {
      return NextResponse.json(
        { success: false, error: { code: "NO_CONTENT", message: "Could not extract meaningful content from this page." } },
        { status: 422 }
      );
    }

    // Use AI to analyze the content
    const prompt = `Analyze this website content and extract e-commerce/business information.

WEBSITE CONTENT:
${textContent}

Extract and return a JSON object with:
{
  "brandName": "The business/brand name if found",
  "industry": "What industry/niche this business is in",
  "brandInsights": "A brief summary of the brand's tone, style, target audience, and unique selling points (2-3 sentences)",
  "products": [
    {
      "name": "Product name",
      "description": "Product description if available",
      "price": "Price as shown (e.g. '$29.99', '15000 XOF')"
    }
  ]
}

Rules:
- Extract up to 20 products maximum
- If no products are found, return an empty array
- Brand insights should capture the brand's voice and positioning
- Keep descriptions concise (max 200 chars each)
- Include prices exactly as shown on the site`;

    const result = await ai.generateJSON<{
      brandName?: string;
      industry?: string;
      brandInsights?: string;
      products?: Array<{ name: string; description?: string; price?: string }>;
    }>(prompt, {
      maxTokens: 3000,
      systemPrompt: SYSTEM_PROMPTS.ecommerceContent,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: { code: "ANALYSIS_FAILED", message: "Failed to analyze the website. Please try again." } },
        { status: 500 }
      );
    }

    // Deduct credits
    const cost = await getDynamicCreditCost("AI_SITE_SCRAPE");
    await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: `Site analysis: ${url}`,
      referenceType: "site_scrape",
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error("Site scrape error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to analyze site. Please try again." } },
      { status: 500 }
    );
  }
}
