import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { connectExistingDomain } from "@/lib/domains/manager";

/**
 * POST /api/domains/connect
 * Connect a user's existing domain (BYOD — Bring Your Own Domain).
 * Any authenticated user can connect a domain — no store required.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const domain = body.domain as string | undefined;

    if (!domain || typeof domain !== "string" || !domain.trim()) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_DOMAIN", message: "A domain name is required" } },
        { status: 400 }
      );
    }

    // Basic domain format validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    const cleanDomain = domain.trim().toLowerCase();

    if (!domainRegex.test(cleanDomain)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_FORMAT", message: "Invalid domain format. Please enter a valid domain like example.com" } },
        { status: 400 }
      );
    }

    // Check if domain is already registered in our system
    const existingDomain = await prisma.storeDomain.findUnique({
      where: { domainName: cleanDomain },
    });

    if (existingDomain) {
      return NextResponse.json(
        { success: false, error: { code: "DOMAIN_EXISTS", message: "This domain is already connected to an account" } },
        { status: 409 }
      );
    }

    // Optionally link to user's store if they have one
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    const result = await connectExistingDomain({
      storeId: store?.id || null,
      userId: session.userId,
      domain: cleanDomain,
    });

    // Mark the store as having pending changes (user will publish when ready)
    if (store?.id) {
      const { markStoreAsPending } = await import("@/lib/store-builder/pending-changes");
      markStoreAsPending(store.id).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: {
        domainId: result.domainId,
        nameservers: result.nameservers,
        instructions: result.instructions,
      },
    });
  } catch (error) {
    console.error("Domain connect error:", error);
    const message = error instanceof Error ? error.message : "Failed to connect domain";
    return NextResponse.json(
      { success: false, error: { code: "CONNECT_FAILED", message } },
      { status: 500 }
    );
  }
}
