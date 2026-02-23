import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { isValidDeliveryTransition } from "@/lib/constants/ecommerce";

const updateStatusSchema = z.object({
  status: z.string().min(1, "Status is required"),
  proofOfDelivery: z
    .object({
      photoUrl: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  codCollected: z.boolean().optional(),
  notes: z.string().optional(),
});

/**
 * Extract access token from Authorization header (Bearer token).
 */
function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * PATCH /api/ecommerce/delivery/[orderId]/status
 * Update delivery status. Can be called by store owner (session) or driver (accessToken).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // Authenticate: session auth OR driver accessToken auth
    let isAuthorized = false;
    let storeId: string | null = null;

    // Try session auth first
    const session = await getSession();
    if (session) {
      const store = await prisma.store.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      if (store) {
        storeId = store.id;
        isAuthorized = true;
      }
    }

    // If no session auth, try driver accessToken
    if (!isAuthorized) {
      const accessToken = getAccessToken(request);
      if (accessToken) {
        const driver = await prisma.deliveryDriver.findFirst({
          where: { accessToken },
          select: { id: true, storeId: true },
        });
        if (driver) {
          storeId = driver.storeId;
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized || !storeId) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Verify order belongs to store
    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Order not found" } },
        { status: 404 }
      );
    }

    // Get the delivery assignment
    const assignment = await prisma.deliveryAssignment.findUnique({
      where: { orderId },
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: { code: "NO_ASSIGNMENT", message: "No delivery assignment for this order" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateStatusSchema.safeParse(body);

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

    // Validate delivery status transition
    if (!isValidDeliveryTransition(assignment.status, data.status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot transition from ${assignment.status} to ${data.status}`,
          },
        },
        { status: 400 }
      );
    }

    // Build update data for the assignment
    const assignmentUpdate: Record<string, unknown> = {
      status: data.status,
    };

    if (data.notes !== undefined) {
      assignmentUpdate.notes = data.notes;
    }

    if (data.proofOfDelivery) {
      assignmentUpdate.proofOfDelivery = JSON.stringify(data.proofOfDelivery);
    }

    if (data.codCollected !== undefined) {
      assignmentUpdate.codCollected = data.codCollected;
    }

    // Handle delivered status
    if (data.status === "delivered") {
      assignmentUpdate.actualDeliveryTime = new Date();
      if (data.codCollected !== undefined) {
        assignmentUpdate.codCollected = data.codCollected;
      }
    }

    // Execute in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the assignment
      const updated = await tx.deliveryAssignment.update({
        where: { id: assignment.id },
        data: assignmentUpdate,
        include: {
          driver: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      // When delivered: update order status, handle COD payment
      if (data.status === "delivered") {
        const orderUpdate: Record<string, unknown> = {
          status: "DELIVERED",
        };

        // If COD and cod collected, mark payment as paid
        if (order.paymentMethod === "cod" && data.codCollected) {
          orderUpdate.paymentStatus = "paid";
        }

        await tx.order.update({
          where: { id: orderId },
          data: orderUpdate,
        });

        // Set driver back to available
        await tx.deliveryDriver.update({
          where: { id: assignment.driverId },
          data: { status: "available" },
        });
      }

      // When failed: set driver back to available
      if (data.status === "failed") {
        await tx.deliveryDriver.update({
          where: { id: assignment.driverId },
          data: { status: "available" },
        });
      }

      return updated;
    });

    const parsed = {
      ...result,
      pickupAddress: JSON.parse(result.pickupAddress),
      deliveryAddress: JSON.parse(result.deliveryAddress),
      proofOfDelivery: JSON.parse(result.proofOfDelivery),
      locationHistory: JSON.parse(result.locationHistory),
    };

    return NextResponse.json({ success: true, data: { assignment: parsed } });
  } catch (error) {
    console.error("Update delivery status error:", error);
    return NextResponse.json(
      { success: false, error: { code: "UPDATE_FAILED", message: "Failed to update delivery status" } },
      { status: 500 }
    );
  }
}
