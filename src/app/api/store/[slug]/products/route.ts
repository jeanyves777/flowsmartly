import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/store/[slug]/products
 * Public: Fetch active products for a store.
 * Query params: category, search, sort (newest|price_asc|price_desc), page, limit
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
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12")));

    // Build where clause
    const where: Record<string, unknown> = {
      storeId: store.id,
      status: "ACTIVE",
      deletedAt: null,
    };

    if (category) {
      where.categoryId = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Sort
    let orderBy: Record<string, string> = { createdAt: "desc" };
    if (sort === "price_asc") orderBy = { priceCents: "asc" };
    else if (sort === "price_desc") orderBy = { priceCents: "desc" };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          priceCents: true,
          comparePriceCents: true,
          currency: true,
          images: true,
          shortDescription: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    const parsedProducts = products.map((p) => ({
      ...p,
      images: JSON.parse(p.images || "[]"),
    }));

    return NextResponse.json({
      success: true,
      data: {
        products: parsedProducts,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Public products fetch error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch products" } },
      { status: 500 }
    );
  }
}
