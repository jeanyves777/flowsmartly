import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";

/**
 * POST /api/store/[slug]/feedback
 * Customer submits feedback for a delivered order.
 * Body: { orderId: string, rating: number (1-5), comment?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json();
    const { orderId, rating, comment } = body;

    if (!orderId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "orderId and rating (1-5) required" }, { status: 400 });
    }

    // Verify the order belongs to this customer and store
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        storeId: store.id,
        customerEmail: customer.email,
        status: "DELIVERED",
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found or not delivered" }, { status: 404 });
    }

    // Check if feedback already exists
    const existing = await prisma.orderFeedback.findUnique({
      where: { orderId },
    });
    if (existing) {
      return NextResponse.json({ error: "Feedback already submitted for this order" }, { status: 400 });
    }

    const feedback = await prisma.orderFeedback.create({
      data: {
        orderId,
        storeId: store.id,
        customerEmail: customer.email,
        customerName: customer.name,
        rating: Math.round(rating),
        comment: comment?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, data: feedback });
  } catch (err) {
    console.error("Feedback error:", err);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}

/**
 * GET /api/store/[slug]/feedback?orderId=xxx
 * Check if feedback exists for an order (customer view).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (orderId) {
      const feedback = await prisma.orderFeedback.findUnique({
        where: { orderId },
      });
      return NextResponse.json({ success: true, data: feedback });
    }

    // Public store rating summary
    const agg = await prisma.orderFeedback.aggregate({
      where: { storeId: store.id },
      _avg: { rating: true },
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        averageRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
        totalReviews: agg._count.id,
      },
    });
  } catch (err) {
    console.error("Feedback GET error:", err);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}
