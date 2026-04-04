import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { recordChange } from "@/lib/listsmartly/bulk-operations";

// GET /api/listsmartly/listings/[id] - Get single listing with directory info and change history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    const listing = await prisma.businessListing.findFirst({
      where: { id, profileId: profile.id },
      include: {
        directory: true,
        changeHistory: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { success: false, error: { message: "Listing not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        listing: {
          ...listing,
          inconsistencies: JSON.parse(listing.inconsistencies),
          directory: {
            ...listing.directory,
            industries: JSON.parse(listing.directory.industries || "[]"),
          },
        },
      },
    });
  } catch (error) {
    console.error("Get listing error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch listing" } },
      { status: 500 }
    );
  }
}

// PUT /api/listsmartly/listings/[id] - Update listing fields with change tracking
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    const listing = await prisma.businessListing.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!listing) {
      return NextResponse.json(
        { success: false, error: { message: "Listing not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      "status", "listingUrl", "businessName", "phone",
      "email", "website", "address", "description",
    ];

    const updateData: Record<string, unknown> = {};
    const listingRecord = listing as Record<string, unknown>;

    // Record changes for each modified field
    for (const field of allowedFields) {
      if (body[field] !== undefined && body[field] !== listingRecord[field]) {
        await recordChange(
          id,
          field,
          String(listingRecord[field] || ""),
          String(body[field] || ""),
          "user",
          "manual_update"
        );
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        data: { listing: { ...listing, inconsistencies: JSON.parse(listing.inconsistencies) } },
      });
    }

    updateData.lastUpdatedAt = new Date();

    const updated = await prisma.businessListing.update({
      where: { id },
      data: updateData,
      include: {
        directory: {
          select: { id: true, slug: true, name: true, url: true, tier: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        listing: {
          ...updated,
          inconsistencies: JSON.parse(updated.inconsistencies),
        },
      },
    });
  } catch (error) {
    console.error("Update listing error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update listing" } },
      { status: 500 }
    );
  }
}
