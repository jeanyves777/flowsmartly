import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { isValidOrderTransition } from "@/lib/constants/ecommerce";
import { restoreInventory } from "@/lib/store/inventory";
import { notifyShippingUpdate, notifyOrderDelivered } from "@/lib/notifications/commerce";

const updateOrderSchema = z.object({
  status: z.string().optional(),
  trackingNumber: z.string().optional(),
  shippingMethod: z.string().optional(),
  estimatedDelivery: z.string().optional(), // ISO date string
  notes: z.string().optional(),
  paymentStatus: z.string().optional(),
  cancelReason: z.string().optional(),
});

/**
 * GET /api/ecommerce/orders/[id]
 * Get order detail with delivery assignment and driver info.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Find user's store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    const order = await prisma.order.findFirst({
      where: { id, storeId: store.id },
      include: {
        deliveryAssignment: {
          include: {
            driver: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Order not found" } },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const parsed = {
      ...order,
      items: JSON.parse(order.items),
      shippingAddress: JSON.parse(order.shippingAddress),
      deliveryAssignment: order.deliveryAssignment
        ? {
            ...order.deliveryAssignment,
            pickupAddress: JSON.parse(order.deliveryAssignment.pickupAddress),
            deliveryAddress: JSON.parse(order.deliveryAssignment.deliveryAddress),
            proofOfDelivery: JSON.parse(order.deliveryAssignment.proofOfDelivery),
            locationHistory: JSON.parse(order.deliveryAssignment.locationHistory),
          }
        : null,
    };

    return NextResponse.json({ success: true, data: { order: parsed } });
  } catch (error) {
    console.error("Get order error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch order" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ecommerce/orders/[id]
 * Update order: status transitions, tracking info, notes, payment status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Find user's store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateOrderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Fetch the order
    const order = await prisma.order.findFirst({
      where: { id, storeId: store.id },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Order not found" } },
        { status: 404 }
      );
    }

    // Validate status transition
    if (data.status) {
      if (!isValidOrderTransition(order.status, data.status)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_TRANSITION",
              message: `Cannot transition from ${order.status} to ${data.status}`,
            },
          },
          { status: 400 }
        );
      }

      // Require cancelReason when cancelling
      if (data.status === "CANCELLED" && !data.cancelReason) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CANCEL_REASON_REQUIRED",
              message: "Cancel reason is required when cancelling an order",
            },
          },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (data.status) updateData.status = data.status;
    if (data.trackingNumber !== undefined) updateData.trackingNumber = data.trackingNumber;
    if (data.shippingMethod !== undefined) updateData.shippingMethod = data.shippingMethod;
    if (data.estimatedDelivery !== undefined) {
      updateData.estimatedDelivery = data.estimatedDelivery
        ? new Date(data.estimatedDelivery)
        : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus;
    if (data.cancelReason !== undefined) updateData.cancelReason = data.cancelReason;

    // Update the order
    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        deliveryAssignment: {
          include: {
            driver: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Side effects on status change
    if (data.status === "DELIVERED") {
      // Increment product orderCount and revenueCents
      const items = JSON.parse(order.items) as Array<{
        productId?: string;
        quantity: number;
        priceCents: number;
      }>;

      for (const item of items) {
        if (item.productId) {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              orderCount: { increment: item.quantity },
              revenueCents: { increment: item.priceCents * item.quantity },
            },
          }).catch(() => {
            // Product may have been deleted
          });
        }
      }
    }

    if (data.status === "CANCELLED") {
      // Restore inventory on cancellation
      restoreInventory(order.id).catch((err) =>
        console.error("Failed to restore inventory:", err)
      );
    }

    if (data.status === "CONFIRMED" && order.status === "PENDING") {
      // Increment store orderCount and totalRevenueCents on first CONFIRMED
      await prisma.store.update({
        where: { id: store.id },
        data: {
          orderCount: { increment: 1 },
          totalRevenueCents: { increment: order.totalCents },
        },
      });
    }

    // Send email notifications on status changes (fire-and-forget)
    if (data.status === "SHIPPED" || data.status === "PROCESSING") {
      const orderStore = await prisma.store.findUnique({
        where: { id: store.id },
        select: { name: true, slug: true },
      });
      if (orderStore) {
        notifyShippingUpdate({
          buyerEmail: order.customerEmail,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          status: data.status === "SHIPPED" ? "Shipped" : "Processing",
          trackingNumber: data.trackingNumber || order.trackingNumber || undefined,
          shippingMethod: data.shippingMethod || order.shippingMethod || undefined,
          storeSlug: orderStore.slug,
          storeName: orderStore.name,
          buyerUserId: order.buyerUserId || undefined,
        }).catch((err) => console.error("Failed to send shipping notification:", err));
      }
    }

    if (data.status === "DELIVERED") {
      const orderStore = await prisma.store.findUnique({
        where: { id: store.id },
        select: { name: true, slug: true },
      });
      if (orderStore) {
        notifyOrderDelivered({
          buyerEmail: order.customerEmail,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          storeName: orderStore.name,
          storeSlug: orderStore.slug,
          buyerUserId: order.buyerUserId || undefined,
        }).catch((err) => console.error("Failed to send delivery notification:", err));
      }
    }

    // Parse JSON fields for response
    const parsed = {
      ...updated,
      items: JSON.parse(updated.items),
      shippingAddress: JSON.parse(updated.shippingAddress),
      deliveryAssignment: updated.deliveryAssignment
        ? {
            ...updated.deliveryAssignment,
            pickupAddress: JSON.parse(updated.deliveryAssignment.pickupAddress),
            deliveryAddress: JSON.parse(updated.deliveryAssignment.deliveryAddress),
            proofOfDelivery: JSON.parse(updated.deliveryAssignment.proofOfDelivery),
            locationHistory: JSON.parse(updated.deliveryAssignment.locationHistory),
          }
        : null,
    };

    return NextResponse.json({ success: true, data: { order: parsed } });
  } catch (error) {
    console.error("Update order error:", error);
    return NextResponse.json(
      { success: false, error: { code: "UPDATE_FAILED", message: "Failed to update order" } },
      { status: 500 }
    );
  }
}
