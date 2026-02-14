import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/credit-packages - List all credit packages
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session?.adminId) {
      return NextResponse.json(
        { success: false, error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const packages = await prisma.creditPackage.findMany({
      orderBy: { sortOrder: "asc" },
    });

    // Summary stats
    const activePackages = packages.filter((p) => p.isActive);
    const totalRevenuePotential = activePackages.reduce(
      (sum, p) => sum + p.priceCents,
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        packages,
        stats: {
          total: packages.length,
          active: activePackages.length,
          totalRevenuePotential,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching credit packages:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch credit packages" } },
      { status: 500 }
    );
  }
}

// POST /api/admin/credit-packages - Create a new credit package
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session?.adminId) {
      return NextResponse.json(
        { success: false, error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      packageId,
      name,
      description,
      credits,
      priceCents,
      bonusCredits,
      discountPercent,
      stripePriceId,
      stripeProductId,
      isPopular,
      sortOrder,
    } = body;

    // Validate required fields
    if (!packageId || !name || credits === undefined || priceCents === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "packageId, name, credits, and priceCents are required" },
        },
        { status: 400 }
      );
    }

    // Check for duplicate packageId
    const existing = await prisma.creditPackage.findUnique({
      where: { packageId },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { message: "Package ID already exists" } },
        { status: 409 }
      );
    }

    const creditPackage = await prisma.creditPackage.create({
      data: {
        packageId,
        name,
        description: description || null,
        credits: parseInt(credits, 10),
        priceCents: parseInt(priceCents, 10),
        bonusCredits: bonusCredits !== undefined ? parseInt(bonusCredits, 10) : 0,
        discountPercent: discountPercent !== undefined ? parseInt(discountPercent, 10) : 0,
        stripePriceId: stripePriceId || null,
        stripeProductId: stripeProductId || null,
        isPopular: isPopular || false,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: creditPackage,
    });
  } catch (error) {
    console.error("Error creating credit package:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create credit package" } },
      { status: 500 }
    );
  }
}

// PUT /api/admin/credit-packages - Update a credit package
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session?.adminId) {
      return NextResponse.json(
        { success: false, error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      name,
      description,
      credits,
      priceCents,
      bonusCredits,
      discountPercent,
      stripePriceId,
      stripeProductId,
      isPopular,
      isActive,
      sortOrder,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Package ID is required" } },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (credits !== undefined) updateData.credits = parseInt(credits, 10);
    if (priceCents !== undefined) updateData.priceCents = parseInt(priceCents, 10);
    if (bonusCredits !== undefined) updateData.bonusCredits = parseInt(bonusCredits, 10);
    if (discountPercent !== undefined) updateData.discountPercent = parseInt(discountPercent, 10);
    if (stripePriceId !== undefined) updateData.stripePriceId = stripePriceId;
    if (stripeProductId !== undefined) updateData.stripeProductId = stripeProductId;
    if (isPopular !== undefined) updateData.isPopular = isPopular;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder, 10);

    const creditPackage = await prisma.creditPackage.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: creditPackage,
    });
  } catch (error) {
    console.error("Error updating credit package:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update credit package" } },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/credit-packages - Soft delete (set isActive=false)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session?.adminId) {
      return NextResponse.json(
        { success: false, error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Package ID is required" } },
        { status: 400 }
      );
    }

    // Soft delete - just disable it
    const creditPackage = await prisma.creditPackage.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: creditPackage,
      message: "Credit package disabled",
    });
  } catch (error) {
    console.error("Error deleting credit package:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete credit package" } },
      { status: 500 }
    );
  }
}
