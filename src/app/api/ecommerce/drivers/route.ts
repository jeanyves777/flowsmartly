import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const createDriverSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().min(1, "Phone is required").max(30),
  email: z.string().email().optional().or(z.literal("")),
  vehicleType: z.enum(["bike", "car", "truck"]).default("bike"),
  region: z.string().max(100).optional(),
});

/**
 * GET /api/ecommerce/drivers
 * List drivers for user's store. Includes count of active assignments.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

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

    const drivers = await prisma.deliveryDriver.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            assignments: {
              where: {
                status: { notIn: ["delivered", "failed"] },
              },
            },
          },
        },
      },
    });

    const driversWithCounts = drivers.map((driver) => ({
      ...driver,
      activeAssignmentCount: driver._count.assignments,
      _count: undefined,
    }));

    return NextResponse.json({
      success: true,
      data: { drivers: driversWithCounts },
    });
  } catch (error) {
    console.error("List drivers error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch drivers" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ecommerce/drivers
 * Create a new delivery driver with a unique access token.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

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
    const validation = createDriverSchema.safeParse(body);

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
    const accessToken = crypto.randomUUID();

    const driver = await prisma.deliveryDriver.create({
      data: {
        storeId: store.id,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        vehicleType: data.vehicleType,
        region: data.region || null,
        accessToken,
      },
    });

    return NextResponse.json({
      success: true,
      data: { driver },
    });
  } catch (error) {
    console.error("Create driver error:", error);
    return NextResponse.json(
      { success: false, error: { code: "CREATE_FAILED", message: "Failed to create driver" } },
      { status: 500 }
    );
  }
}
