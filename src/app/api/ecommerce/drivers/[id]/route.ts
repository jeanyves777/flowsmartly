import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const updateDriverSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(1).max(30).optional(),
  email: z.string().email().optional().nullable(),
  vehicleType: z.enum(["bike", "car", "truck"]).optional(),
  isActive: z.boolean().optional(),
  status: z.enum(["available", "busy", "offline"]).optional(),
});

/**
 * PATCH /api/ecommerce/drivers/[id]
 * Update driver info.
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

    // Verify driver belongs to store
    const driver = await prisma.deliveryDriver.findFirst({
      where: { id, storeId: store.id },
    });

    if (!driver) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Driver not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateDriverSchema.safeParse(body);

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
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.vehicleType !== undefined) updateData.vehicleType = data.vehicleType;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.status !== undefined) updateData.status = data.status;

    const updated = await prisma.deliveryDriver.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: { driver: updated } });
  } catch (error) {
    console.error("Update driver error:", error);
    return NextResponse.json(
      { success: false, error: { code: "UPDATE_FAILED", message: "Failed to update driver" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ecommerce/drivers/[id]
 * Soft deactivate a driver. Only if no active assignments.
 */
export async function DELETE(
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

    // Verify driver belongs to store
    const driver = await prisma.deliveryDriver.findFirst({
      where: { id, storeId: store.id },
    });

    if (!driver) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Driver not found" } },
        { status: 404 }
      );
    }

    // Check for active assignments
    const activeAssignments = await prisma.deliveryAssignment.count({
      where: {
        driverId: id,
        status: { notIn: ["delivered", "failed"] },
      },
    });

    if (activeAssignments > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "HAS_ACTIVE_ASSIGNMENTS",
            message: "Cannot deactivate driver with active assignments",
          },
        },
        { status: 400 }
      );
    }

    const updated = await prisma.deliveryDriver.update({
      where: { id },
      data: { isActive: false, status: "offline" },
    });

    return NextResponse.json({ success: true, data: { driver: updated } });
  } catch (error) {
    console.error("Deactivate driver error:", error);
    return NextResponse.json(
      { success: false, error: { code: "DELETE_FAILED", message: "Failed to deactivate driver" } },
      { status: 500 }
    );
  }
}
