import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * POST /api/ecommerce/products/bulk-activate
 * Activate all DRAFT products in the user's store at once.
 */
export async function POST(_request: NextRequest) {
  try {
    // Auth check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Get user's store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "No store found for this user." } },
        { status: 404 }
      );
    }

    // Bulk activate all DRAFT products
    const result = await prisma.product.updateMany({
      where: { storeId: store.id, status: "DRAFT" },
      data: { status: "ACTIVE" },
    });

    // Update denormalized product count on the store
    const activeCount = await prisma.product.count({
      where: { storeId: store.id, status: "ACTIVE", deletedAt: null },
    });

    await prisma.store.update({
      where: { id: store.id },
      data: { productCount: activeCount },
    });

    return NextResponse.json({
      success: true,
      data: {
        activatedCount: result.count,
        totalActiveProducts: activeCount,
      },
    });
  } catch (error) {
    console.error("Bulk activate products error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to activate products" } },
      { status: 500 }
    );
  }
}
