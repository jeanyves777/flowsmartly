import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ORDER_STATUSES } from "@/lib/constants/ecommerce";

const assignDriverSchema = z.object({
  driverId: z.string().min(1, "Driver ID is required"),
  pickupAddress: z.record(z.unknown()).optional(),
  estimatedDeliveryTime: z.string().optional(), // ISO date string
});

/**
 * GET /api/ecommerce/delivery/[orderId]
 * Get delivery/tracking info for an order. No auth required (public tracking page).
 * Supports lookup by order ID or order number.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // Try to find order by ID or order number
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: orderId },
          { orderNumber: orderId },
        ],
      },
      include: {
        deliveryAssignment: {
          include: {
            driver: {
              select: {
                name: true,
                phone: true,
                currentLatitude: true,
                currentLongitude: true,
                lastLocationUpdate: true,
              },
            },
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

    // Build status timeline
    const statusOrder = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];
    const currentIndex = statusOrder.indexOf(order.status);
    const isCancelled = order.status === "CANCELLED";
    const isRefunded = order.status === "REFUNDED";

    let timeline = statusOrder.map((status, idx) => ({
      status,
      label: ORDER_STATUSES[status]?.label || status,
      completed: !isCancelled && !isRefunded && idx < currentIndex,
      current: !isCancelled && !isRefunded && idx === currentIndex,
    }));

    if (isCancelled) {
      timeline = [
        ...timeline.map((s) => ({ ...s, completed: false, current: false })),
        { status: "CANCELLED", label: "Cancelled", completed: false, current: true },
      ];
    }

    if (isRefunded) {
      timeline = [
        ...timeline.map((s) => ({ ...s, completed: true, current: false })),
        { status: "REFUNDED", label: "Refunded", completed: false, current: true },
      ];
    }

    // Build delivery info
    const delivery = order.deliveryAssignment
      ? {
          id: order.deliveryAssignment.id,
          status: order.deliveryAssignment.status,
          driverName: order.deliveryAssignment.driver.name,
          driverPhone: order.deliveryAssignment.driver.phone,
          currentLatitude: order.deliveryAssignment.driver.currentLatitude,
          currentLongitude: order.deliveryAssignment.driver.currentLongitude,
          lastLocationUpdate: order.deliveryAssignment.driver.lastLocationUpdate?.toISOString() || null,
          estimatedDeliveryTime: order.deliveryAssignment.estimatedDeliveryTime?.toISOString() || null,
          codAmountCents: order.deliveryAssignment.codAmountCents,
          codCollected: order.deliveryAssignment.codCollected,
        }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          customerName: order.customerName,
          totalCents: order.totalCents,
          currency: order.currency,
          estimatedDelivery: order.estimatedDelivery?.toISOString() || null,
          createdAt: order.createdAt.toISOString(),
        },
        delivery,
        statusTimeline: timeline,
        // Also include legacy assignment field for backwards compatibility
        assignment: order.deliveryAssignment
          ? {
              ...order.deliveryAssignment,
              pickupAddress: JSON.parse(order.deliveryAssignment.pickupAddress),
              deliveryAddress: JSON.parse(order.deliveryAssignment.deliveryAddress),
              proofOfDelivery: JSON.parse(order.deliveryAssignment.proofOfDelivery),
              locationHistory: JSON.parse(order.deliveryAssignment.locationHistory),
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get delivery/tracking info error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch tracking info" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ecommerce/delivery/[orderId]
 * Assign a driver to an order. Requires store owner auth.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const { orderId } = await params;

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

    // Verify order belongs to store
    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId: store.id },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Order not found" } },
        { status: 404 }
      );
    }

    // Check if order already has an assignment
    const existing = await prisma.deliveryAssignment.findUnique({
      where: { orderId },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "ALREADY_ASSIGNED", message: "Order already has a delivery assignment" } },
        { status: 409 }
      );
    }

    const body = await request.json();
    const validation = assignDriverSchema.safeParse(body);

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

    // Verify driver belongs to store and is active
    const driver = await prisma.deliveryDriver.findFirst({
      where: { id: data.driverId, storeId: store.id, isActive: true },
    });

    if (!driver) {
      return NextResponse.json(
        { success: false, error: { code: "DRIVER_NOT_FOUND", message: "Driver not found or inactive" } },
        { status: 404 }
      );
    }

    // Determine COD amount
    const codAmountCents = order.paymentMethod === "cod" ? order.totalCents : null;

    // Create assignment and update driver status in a transaction
    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.deliveryAssignment.create({
        data: {
          orderId,
          driverId: data.driverId,
          pickupAddress: data.pickupAddress ? JSON.stringify(data.pickupAddress) : "{}",
          deliveryAddress: order.shippingAddress,
          estimatedDeliveryTime: data.estimatedDeliveryTime
            ? new Date(data.estimatedDeliveryTime)
            : null,
          codAmountCents,
        },
        include: {
          driver: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      // Set driver status to busy
      await tx.deliveryDriver.update({
        where: { id: data.driverId },
        data: { status: "busy" },
      });

      return created;
    });

    const parsed = {
      ...assignment,
      pickupAddress: JSON.parse(assignment.pickupAddress),
      deliveryAddress: JSON.parse(assignment.deliveryAddress),
      proofOfDelivery: JSON.parse(assignment.proofOfDelivery),
      locationHistory: JSON.parse(assignment.locationHistory),
    };

    return NextResponse.json({ success: true, data: { assignment: parsed } });
  } catch (error) {
    console.error("Assign driver error:", error);
    return NextResponse.json(
      { success: false, error: { code: "ASSIGN_FAILED", message: "Failed to assign driver" } },
      { status: 500 }
    );
  }
}
