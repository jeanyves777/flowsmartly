import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDomainStatus, disconnectDomain } from "@/lib/domains/manager";

/**
 * GET /api/domains/[id]
 * Get domain details including live Cloudflare/SSL status.
 */
export async function GET(
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
      select: { id: true, userId: true },
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

    const status = await getDomainStatus(id);

    return NextResponse.json({
      success: true,
      data: { domain: status },
    });
  } catch (error) {
    console.error("Domain detail error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch domain details";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/domains/[id]
 * Disconnect and remove a domain.
 */
export async function DELETE(
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
      select: { id: true, userId: true, domainName: true, isFree: true, storeId: true },
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

    await disconnectDomain(id);

    // If this was a free domain, reset the store's freeDomainClaimed flag
    if (domain.isFree) {
      await prisma.store.update({
        where: { id: domain.storeId },
        data: { freeDomainClaimed: false },
      });
    }

    return NextResponse.json({
      success: true,
      data: { message: `Domain ${domain.domainName} has been disconnected` },
    });
  } catch (error) {
    console.error("Domain delete error:", error);
    const message = error instanceof Error ? error.message : "Failed to disconnect domain";
    return NextResponse.json(
      { success: false, error: { code: "DELETE_FAILED", message } },
      { status: 500 }
    );
  }
}
