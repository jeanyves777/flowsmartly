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
        include: {
          variants: {
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const parsedProducts = products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description || "",
      shortDescription: p.shortDescription || "",
      priceCents: p.priceCents,
      comparePriceCents: p.comparePriceCents,
      currency: p.currency,
      categoryId: p.categoryId || "",
      images: (() => {
        try { return JSON.parse(p.images || "[]"); } catch { return []; }
      })(),
      tags: (() => {
        try { return JSON.parse(p.tags || "[]"); } catch { return []; }
      })(),
      labels: (() => {
        try { return JSON.parse(p.labels || "[]"); } catch { return []; }
      })(),
      badges: (() => {
        try { return JSON.parse(p.labels || "[]"); } catch { return []; }
      })(),
      featured: (() => {
        try {
          const arr: string[] = JSON.parse(p.labels || "[]");
          return Array.isArray(arr) && arr.includes("featured");
        } catch { return false; }
      })(),
      inStock: p.trackInventory ? p.quantity > 0 : true,
      variants: p.variants.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku || "",
        priceCents: v.priceCents,
        comparePriceCents: v.comparePriceCents,
        options: (() => {
          try { return JSON.parse(v.options || "{}"); } catch { return {}; }
        })(),
        quantity: v.quantity,
        imageUrl: v.imageUrl || "",
        inStock: v.quantity > 0,
      })),
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
