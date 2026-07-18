import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";

/**
 * POST /api/ecommerce/ai/suggest-concept — for a user who isn't sure what to
 * sell. Reads their Brand Kit and proposes ONE focused, sellable store concept
 * (name, what-you-sell line, starter products with prices, style) to prefill the
 * store-build brief. Free (a cheap pre-purchase onboarding helper), auth-gated.
 */

interface ConceptResult {
  storeName?: string;
  sells?: string;
  products?: Array<{ name?: string; price?: number | string }>;
  style?: string;
}

function safeArr(s: string | null | undefined): string[] {
  if (!s) return [];
  try { const a = JSON.parse(s); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Please log in." }, { status: 401 });

    const brand = await prisma.brandKit.findFirst({ where: { userId: session.userId } });

    const parts: string[] = [];
    if (brand?.name) parts.push(`Business name: ${brand.name}`);
    if (brand?.tagline) parts.push(`Tagline: ${brand.tagline}`);
    if (brand?.description) parts.push(`Description: ${brand.description}`);
    if (brand?.industry) parts.push(`Industry: ${brand.industry}`);
    if (brand?.niche) parts.push(`Niche: ${brand.niche}`);
    if (brand?.targetAudience) parts.push(`Target audience: ${brand.targetAudience}`);
    const keywords = safeArr(brand?.keywords);
    if (keywords.length) parts.push(`Brand keywords: ${keywords.join(", ")}`);
    const known = safeArr(brand?.products);
    if (known.length) parts.push(`Known products/services: ${known.join(", ")}`);

    const hasBrand = parts.length > 0;
    const brandBlock = hasBrand ? parts.join("\n") : "No brand details are set up yet — suggest a broadly appealing, easy-to-start concept.";

    const prompt = `A user wants to launch an online store but isn't sure exactly what to sell. Using their brand identity, propose ONE focused, realistic, sellable store concept they can launch today.

Brand identity:
${brandBlock}

Return JSON with exactly these keys:
- "storeName": a good store name (reuse the business name if one is given)
- "sells": ONE sentence describing what the store sells (products/category) and who it is for
- "products": an array of 4-6 concrete starter products, each an object { "name": string, "price": number } — realistic prices as plain numbers (no currency symbol), sensible for the category
- "style": one of "Modern", "Bold", "Minimal", "Elegant", "Playful" that best fits the brand

Make the products specific to THIS business — never generic filler. Keep it coherent (all products fit one store).`;

    const result = await ai.generateJSON<ConceptResult>(prompt, {
      maxTokens: 900,
      systemPrompt: "You are an ecommerce merchandising expert who turns a brand identity into one concrete, coherent, sellable online-store concept.",
    });

    if (!result) return NextResponse.json({ success: false, error: "Couldn't generate a suggestion — try again." }, { status: 502 });

    const products = Array.isArray(result.products) ? result.products : [];
    const productsText = products
      .filter((p) => p && p.name)
      .map((p) => (p.price != null && String(p.price).trim() !== "" ? `${p.name} $${p.price}` : String(p.name)))
      .join(", ");

    const style = ["Modern", "Bold", "Minimal", "Elegant", "Playful"].includes(result.style || "") ? result.style : "Modern";

    return NextResponse.json({
      success: true,
      data: {
        storeName: result.storeName || brand?.name || "",
        sells: result.sells || "",
        products: productsText,
        style,
        hasBrand,
      },
    });
  } catch (error) {
    console.error("suggest-concept error:", error);
    return NextResponse.json({ success: false, error: "Couldn't generate a suggestion." }, { status: 500 });
  }
}
