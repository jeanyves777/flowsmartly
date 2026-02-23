import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/store/[slug]/products/[productSlug]
 * Public: Fetch single product by store slug + product slug. Includes variants.
 * Increments viewCount (fire-and-forget).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; productSlug: string }> }
) {
  try {
    const { slug, productSlug } = await params;

    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true, isActive: true, currency: true },
    });

    if (!store || !store.isActive) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Store not found" } },
        { status: 404 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { storeId_slug: { storeId: store.id, slug: productSlug } },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!product || product.status !== "ACTIVE" || product.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
        { status: 404 }
      );
    }

    // Fire-and-forget: increment view count
    prisma.product.update({
      where: { id: product.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        product: {
          ...product,
          images: JSON.parse(product.images || "[]"),
          tags: JSON.parse(product.tags || "[]"),
          variants: product.variants.map((v) => ({
            ...v,
            options: JSON.parse(v.options || "{}"),
          })),
        },
      },
    });
  } catch (error) {
    console.error("Public product detail fetch error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch product" } },
      { status: 500 }
    );
  }
}
