import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { bulkUpdateListings } from "@/lib/listsmartly/bulk-operations";

// POST /api/listsmartly/listings/bulk-update - Bulk update multiple listings
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { listingIds, updates, changedBy } = body;

    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "listingIds must be a non-empty array" } },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "updates must be a non-empty object" } },
        { status: 400 }
      );
    }

    // Verify all listings belong to this profile
    const ownedCount = await prisma.businessListing.count({
      where: { id: { in: listingIds }, profileId: profile.id },
    });
    if (ownedCount !== listingIds.length) {
      return NextResponse.json(
        { success: false, error: { message: "Some listings do not belong to your profile" } },
        { status: 403 }
      );
    }

    const result = await bulkUpdateListings({
      listingIds,
      updates,
      changedBy: changedBy || "user",
    });

    return NextResponse.json({
      success: true,
      data: { updated: result.updated },
    });
  } catch (error) {
    console.error("Bulk update listings error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to bulk update listings" } },
      { status: 500 }
    );
  }
}
