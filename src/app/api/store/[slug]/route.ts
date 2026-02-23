import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/store/[slug]
 * Public: Fetch store info by slug. Only returns active stores.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const store = await prisma.store.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        bannerUrl: true,
        industry: true,
        currency: true,
        theme: true,
        isActive: true,
      },
    });

    if (!store || !store.isActive) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Store not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          description: store.description,
          logoUrl: store.logoUrl,
          bannerUrl: store.bannerUrl,
          industry: store.industry,
          currency: store.currency,
          theme: JSON.parse(store.theme || "{}"),
        },
      },
    });
  } catch (error) {
    console.error("Public store fetch error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch store" } },
      { status: 500 }
    );
  }
}
