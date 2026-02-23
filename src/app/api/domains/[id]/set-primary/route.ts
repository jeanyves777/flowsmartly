import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { setPrimaryDomain } from "@/lib/domains/manager";

/**
 * POST /api/domains/[id]/set-primary
 * Set a domain as the primary domain for the store.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify ownership
    const domain = await prisma.storeDomain.findUnique({
      where: { id },
      select: { id: true, userId: true, domainName: true, isPrimary: true },
    });

    if (!domain) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Domain not found" } },
        { status: 404 }
      );
    }

    if (domain.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "You do not own this domain" } },
        { status: 403 }
      );
    }

    if (domain.isPrimary) {
      return NextResponse.json({
        success: true,
        data: { message: `${domain.domainName} is already the primary domain` },
      });
    }

    await setPrimaryDomain(id);

    // Fetch the updated domain
    const updated = await prisma.storeDomain.findUnique({
      where: { id },
      select: {
        id: true,
        domainName: true,
        tld: true,
        isPrimary: true,
        registrarStatus: true,
        sslStatus: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { domain: updated },
    });
  } catch (error) {
    console.error("Set primary domain error:", error);
    const message = error instanceof Error ? error.message : "Failed to set primary domain";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
