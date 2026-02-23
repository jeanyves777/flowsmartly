import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/domains
 * List all domains for the authenticated user's store.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Find user's store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json({
        success: true,
        data: { domains: [] },
      });
    }

    // Fetch all domains for this store
    const domains = await prisma.storeDomain.findMany({
      where: { storeId: store.id },
      orderBy: [
        { isPrimary: "desc" },
        { createdAt: "asc" },
      ],
      select: {
        id: true,
        domainName: true,
        tld: true,
        registrarStatus: true,
        sslStatus: true,
        isFree: true,
        isPrimary: true,
        isConnected: true,
        purchasePriceCents: true,
        renewalPriceCents: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { domains },
    });
  } catch (error) {
    console.error("Domain list error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch domains" } },
      { status: 500 }
    );
  }
}
