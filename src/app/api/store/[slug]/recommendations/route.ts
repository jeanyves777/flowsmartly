import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getTrendingProducts, getProductRecommendations } from "@/lib/store/recommendations";

/**
 * GET /api/store/[slug]/recommendations
 * Public: Returns product recommendations for the storefront.
 * Query params: productId (specific product recs), type=trending (trending products)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!store || !store.isActive) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Store not found" } },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const type = searchParams.get("type");

    // Product-specific recommendations
    if (productId) {
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          storeId: store.id,
          status: "ACTIVE",
          deletedAt: null,
        },
      });

      if (!product) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
          { status: 404 }
        );
      }

      const { similar, boughtTogether, trending } = await getProductRecommendations(productId, store.id);

      return NextResponse.json({
        success: true,
        data: { similar, boughtTogether, trending },
      });
    }

    // Trending products
    if (type === "trending") {
      const trending = await getTrendingProducts(store.id, 12);

      return NextResponse.json({
        success: true,
        data: { trending },
      });
    }

    // No valid query provided
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Provide productId or type=trending" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Recommendations fetch error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch recommendations" } },
      { status: 500 }
    );
  }
}
