import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";

/**
 * GET /api/store/[slug]/products/[productSlug]/reviews
 * Get reviews for a product (public — no auth required).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; productSlug: string }> }
) {
  try {
    const { slug, productSlug } = await params;

    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const product = await prisma.product.findFirst({
      where: { storeId: store.id, slug: productSlug, deletedAt: null },
      select: { id: true, reviewCount: true, avgRating: true, orderCount: true },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const reviews = await prisma.productReview.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: {
        reviews,
        stats: {
          avgRating: product.avgRating,
          reviewCount: product.reviewCount,
          salesCount: product.orderCount,
        },
      },
    });
  } catch (err) {
    console.error("GET reviews error:", err);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

/**
 * POST /api/store/[slug]/products/[productSlug]/reviews
 * Customer submits a product review (must be logged in, ideally a verified purchaser).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; productSlug: string }> }
) {
  try {
    const { slug, productSlug } = await params;

    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Please log in to leave a review" }, { status: 401 });

    const product = await prisma.product.findFirst({
      where: { storeId: store.id, slug: productSlug, deletedAt: null },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const body = await request.json();
    const { rating, title, comment } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    // Check if customer already reviewed this product
    const existing = await prisma.productReview.findUnique({
      where: { productId_customerEmail: { productId: product.id, customerEmail: customer.email } },
    });
    if (existing) {
      return NextResponse.json({ error: "You have already reviewed this product" }, { status: 400 });
    }

    // Check if customer actually purchased this product (verified review)
    const hasPurchased = await prisma.order.findFirst({
      where: {
        storeId: store.id,
        customerEmail: customer.email,
        status: "DELIVERED",
        items: { contains: product.id },
      },
      select: { id: true },
    });

    const review = await prisma.productReview.create({
      data: {
        productId: product.id,
        storeId: store.id,
        customerEmail: customer.email,
        customerName: customer.name,
        rating: Math.round(rating),
        title: title?.trim() || null,
        comment: comment?.trim() || null,
        verified: !!hasPurchased,
      },
    });

    // Update product stats
    const agg = await prisma.productReview.aggregate({
      where: { productId: product.id },
      _avg: { rating: true },
      _count: { id: true },
    });

    await prisma.product.update({
      where: { id: product.id },
      data: {
        avgRating: agg._avg.rating || 0,
        reviewCount: agg._count.id,
      },
    });

    return NextResponse.json({ success: true, data: review });
  } catch (err) {
    console.error("POST review error:", err);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
