import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { connectExistingDomain } from "@/lib/domains/manager";

/**
 * POST /api/domains/connect
 * Connect a user's existing domain (BYOD — Bring Your Own Domain).
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

    // Validate user has a store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true, ecomSubscriptionStatus: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You need an active FlowShop store to connect a domain" } },
        { status: 400 }
      );
    }

    const hasActiveSub = store.ecomSubscriptionStatus === "active" || store.ecomSubscriptionStatus === "trialing";
    if (!hasActiveSub) {
      return NextResponse.json(
        { success: false, error: { code: "INACTIVE_SUBSCRIPTION", message: "An active FlowShop subscription is required" } },
        { status: 400 }
      );
    }

    // Check if domain is already registered in our system
    const existingDomain = await prisma.storeDomain.findUnique({
      where: { domainName: cleanDomain },
    });

    if (existingDomain) {
      return NextResponse.json(
        { success: false, error: { code: "DOMAIN_EXISTS", message: "This domain is already connected to a store" } },
        { status: 409 }
      );
    }

    const result = await connectExistingDomain({
      storeId: store.id,
      userId: session.userId,
      domain: cleanDomain,
    });

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
