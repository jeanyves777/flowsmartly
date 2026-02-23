import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Extract access token from Authorization header (Bearer token) or query param.
 */
function getAccessToken(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check query param
  const { searchParams } = new URL(request.url);
  return searchParams.get("token");
}

/**
 * POST /api/ecommerce/drivers/[id]/location
 * Update driver location. Uses accessToken auth (not session).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = getAccessToken(request);

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Access token required" } },
        { status: 401 }
      );
    }

    // Validate token against the driver
    const driver = await prisma.deliveryDriver.findFirst({
      where: { id, accessToken },
    });

    if (!driver) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TOKEN", message: "Invalid access token" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = locationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid coordinates",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { latitude, longitude } = validation.data;
    const now = new Date();

    // Update driver location
    await prisma.deliveryDriver.update({
      where: { id },
      data: {
        currentLatitude: latitude,
        currentLongitude: longitude,
        lastLocationUpdate: now,
      },
    });

    // Append to active delivery assignment's location history
    const activeAssignments = await prisma.deliveryAssignment.findMany({
      where: {
        driverId: id,
        status: { notIn: ["delivered", "failed"] },
      },
    });

    for (const assignment of activeAssignments) {
      const history = JSON.parse(assignment.locationHistory) as Array<{
        lat: number;
        lng: number;
        timestamp: string;
      }>;
      history.push({ lat: latitude, lng: longitude, timestamp: now.toISOString() });

      await prisma.deliveryAssignment.update({
        where: { id: assignment.id },
        data: { locationHistory: JSON.stringify(history) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update location error:", error);
    return NextResponse.json(
      { success: false, error: { code: "UPDATE_FAILED", message: "Failed to update location" } },
      { status: 500 }
    );
  }
}
