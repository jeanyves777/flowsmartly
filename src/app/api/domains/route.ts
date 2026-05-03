import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getEffectiveVerificationStatus } from "@/lib/domains/verification";

/**
 * GET /api/domains
 * List all domains for the authenticated user (from store + standalone).
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

    // Find user's store (optional — user may not have one)
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true, ecomPlan: true, freeDomainClaimed: true },
    });

    // Fetch ALL domains belonging to this user (store-linked + standalone)
    const domains = await prisma.storeDomain.findMany({
      where: { userId: session.userId },
      orderBy: [
        { isPrimary: "desc" },
        { createdAt: "asc" },
      ],
      select: {
        id: true,
        domainName: true,
        tld: true,
        storeId: true,
        registrarStatus: true,
        registrarVerificationStatus: true,
        registrarVerificationDeadline: true,
        registrarVerificationDaysToSuspend: true,
        registrarVerificationEmailBounced: true,
        registrarVerificationLastCheckedAt: true,
        registrarVerificationLastSentAt: true,
        registrarVerificationError: true,
        sslStatus: true,
        isFree: true,
        isPrimary: true,
        isConnected: true,
        autoRenew: true,
        whoisPrivacy: true,
        nameservers: true,
        verificationStatus: true,
        verifiedAt: true,
        lastVerificationCheckAt: true,
        verificationError: true,
        purchasePriceCents: true,
        renewalPriceCents: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        domains: domains.map((domain) => ({
          ...domain,
          verificationStatus: getEffectiveVerificationStatus({
            isConnected: domain.isConnected,
            verificationStatus: domain.verificationStatus,
            verifiedAt: domain.verifiedAt,
          }),
        })),
        isPro: store?.ecomPlan === "pro",
        freeDomainClaimed: store?.freeDomainClaimed ?? false,
      },
    });
  } catch (error) {
    console.error("Domain list error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch domains" } },
      { status: 500 }
    );
  }
}
