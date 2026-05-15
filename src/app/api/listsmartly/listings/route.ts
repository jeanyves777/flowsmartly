import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getListSmartlyDirectoryPriority } from "@/lib/constants/listsmartly";

// GET /api/listsmartly/listings - List all listings for user's profile
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const tier = searchParams.get("tier");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 250);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { profileId: profile.id };
    if (status) where.status = status;

    // Tier and search require filtering on the directory relation
    const directoryWhere: Record<string, unknown> = { isActive: true };
    if (tier) directoryWhere.tier = parseInt(tier, 10);
    if (search) {
      directoryWhere.name = { contains: search, mode: "insensitive" };
    }
    where.directory = directoryWhere;

    const allListings = await prisma.businessListing.findMany({
      where,
      include: {
        directory: {
          select: {
            id: true,
            slug: true,
            name: true,
            url: true,
            tier: true,
            category: true,
            iconUrl: true,
            submitUrl: true,
            claimUrl: true,
            isActive: true,
          },
        },
      },
    });
    const sortedListings = allListings.sort(
      (a, b) =>
        getListSmartlyDirectoryPriority(a.directory) - getListSmartlyDirectoryPriority(b.directory) ||
        a.directory.name.localeCompare(b.directory.name)
    );
    const listings = sortedListings.slice(skip, skip + limit);
    const total = sortedListings.length;

    return NextResponse.json({
      success: true,
      data: {
        listings: listings.map((l) => ({
          ...l,
          directoryName: l.directory.name,
          directoryUrl: l.directory.url,
          submitUrl: l.directory.submitUrl,
          claimUrl: l.directory.claimUrl,
          tier: l.directory.tier,
          directoryCategory: l.directory.category,
          priority: getListSmartlyDirectoryPriority(l.directory),
          lastChecked: l.lastCheckedAt,
          inconsistencies: JSON.parse(l.inconsistencies),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get listings error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch listings" } },
      { status: 500 }
    );
  }
}

// POST /api/listsmartly/listings - Manually add a listing record
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
    const { directoryId, status, listingUrl, businessName, phone, email, website, address, description } = body;

    if (!directoryId) {
      return NextResponse.json(
        { success: false, error: { message: "directoryId is required" } },
        { status: 400 }
      );
    }

    // Verify directory exists
    const directory = await prisma.listingDirectory.findUnique({
      where: { id: directoryId },
    });
    if (!directory || !directory.isActive) {
      return NextResponse.json(
        { success: false, error: { message: "Directory not found" } },
        { status: 404 }
      );
    }

    const listing = await prisma.businessListing.upsert({
      where: {
        profileId_directoryId: { profileId: profile.id, directoryId },
      },
      update: {
        status: status || "submitted",
        listingUrl: listingUrl || null,
        businessName: businessName || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        address: address || null,
        description: description || null,
        lastUpdatedAt: new Date(),
      },
      create: {
        profileId: profile.id,
        directoryId,
        status: status || "submitted",
        listingUrl: listingUrl || null,
        businessName: businessName || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        address: address || null,
        description: description || null,
      },
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
          ...listing,
          inconsistencies: JSON.parse(listing.inconsistencies),
        },
      },
    });
  } catch (error) {
    console.error("Create listing error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create listing" } },
      { status: 500 }
    );
  }
}
