import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  searchTrends,
  getRelatedQueries,
  getDailyTrends,
  getTrendingForIndustry,
} from "@/lib/store/trends";
import { getTrendingProducts } from "@/lib/store/recommendations";

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
      select: { id: true, industry: true, country: true },
    });
    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const keyword = searchParams.get("keyword");
    const geo = searchParams.get("geo") || "US";

    switch (type) {
      case "search": {
        if (!keyword) {
          return NextResponse.json(
            { success: false, error: { code: "MISSING_KEYWORD", message: "Keyword is required for search trends" } },
            { status: 400 }
          );
        }
        const result = await searchTrends(keyword, geo);
        return NextResponse.json({ success: true, data: { type, ...result } });
      }

      case "related": {
        if (!keyword) {
          return NextResponse.json(
            { success: false, error: { code: "MISSING_KEYWORD", message: "Keyword is required for related queries" } },
            { status: 400 }
          );
        }
        const result = await getRelatedQueries(keyword, geo);
        return NextResponse.json({ success: true, data: { type, ...result } });
      }

      case "daily": {
        const result = await getDailyTrends(geo);
        return NextResponse.json({ success: true, data: { type, ...result } });
      }

      case "store_trending": {
        const result = await getTrendingProducts(store.id);
        return NextResponse.json({ success: true, data: { type, products: result } });
      }

      case "industry": {
        const result = await getTrendingForIndustry(store.industry || "retail", geo);
        return NextResponse.json({ success: true, data: { type, ...result } });
      }

      case "overview": {
        // Fetch daily trends, industry trends, and product categories in parallel
        const storeGeo = store.country || geo;

        // Get product categories for preset chips
        const storeProducts = await prisma.product.findMany({
          where: {
            storeId: store.id,
            status: "ACTIVE",
            deletedAt: null
          },
          select: { name: true, category: true },
          take: 50,
        });

        const categories = [...new Set(storeProducts.map(p => p.category).filter(Boolean))] as string[];
        const topProductNames = storeProducts.slice(0, 5).map(p => p.name);

        const [dailyTrends, industryTrends] = await Promise.all([
          getDailyTrends(storeGeo),
          getTrendingForIndustry(store.industry || "retail", storeGeo),
        ]);

        return NextResponse.json({
          success: true,
          data: {
            type: "overview",
            geo: storeGeo,
            industry: store.industry || "General Retail",
            dailyTrends: dailyTrends.slice(0, 15),
            industryTrends,
            presetKeywords: [
              ...(store.industry ? [store.industry] : []),
              ...categories.slice(0, 4),
              ...topProductNames.slice(0, 3),
            ],
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: "INVALID_TYPE", message: "Invalid type" } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Trends API error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch trends" } },
      { status: 500 }
    );
  }
}
