import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

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
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { profileId: profile.id };
    if (status) where.status = status;

    // Tier and search require filtering on the directory relation
    const directoryWhere: Record<string, unknown> = {};
    if (tier) directoryWhere.tier = parseInt(tier, 10);
    if (search) {
      directoryWhere.name = { contains: search, mode: "insensitive" };
    }
    if (Object.keys(directoryWhere).length > 0) {
      where.directory = directoryWhere;
    }

    const [listings, total] = await Promise.all([
      prisma.businessListing.findMany({
        where,
        include: {
          directory: {
            select: { id: true, slug: true, name: true, url: true, tier: true, category: true, iconUrl: true },
          },
        },
        orderBy: [{ directory: { tier: "asc" } }, { directory: { name: "asc" } }],
        skip,
        take: limit,
      }),
      prisma.businessListing.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        listings: listings.map((l) => ({
          ...l,
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
    if (!directory) {
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
