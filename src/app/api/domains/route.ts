import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getEffectiveVerificationStatus } from "@/lib/domains/verification";

function safeParseNameservers(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function buildDomainAction(domain: {
  isConnected: boolean;
  verificationStatus?: string | null;
  sslStatus: string;
  registrarStatus: string;
  registrarVerificationStatus?: string | null;
  expiresAt?: Date | null;
}) {
  if (domain.isConnected && domain.verificationStatus !== "verified") {
    return {
      type: "verify",
      label: "Verify ownership",
      description: "Add the FlowSmartly TXT record, then verify this domain.",
      priority: 1,
    };
  }

  if (!domain.isConnected && domain.registrarVerificationStatus && domain.registrarVerificationStatus !== "verified") {
    return {
      type: "registrant",
      label: "Confirm registrant email",
      description: "OpenSRS requires registrant email verification before the domain can remain active.",
      priority: 1,
    };
  }

  if (domain.registrarStatus === "registration_failed" || domain.registrarStatus === "pending_registration") {
    return {
      type: "retry",
      label: "Retry registration",
      description: "Registration has not completed. Retry after checking payment and registrant details.",
      priority: 1,
    };
  }

  if (domain.sslStatus !== "active" && domain.sslStatus !== "active_certificate") {
    return {
      type: "ssl",
      label: "Wait for SSL",
      description: "DNS is being checked and SSL will activate after routing is ready.",
      priority: 2,
    };
  }

  const expiryDays = daysUntil(domain.expiresAt || null);
  if (expiryDays !== null && expiryDays <= 30) {
    return {
      type: "renewal",
      label: expiryDays <= 0 ? "Renew now" : "Renew soon",
      description: expiryDays <= 0 ? "This domain is expired." : `This domain expires in ${expiryDays} days.`,
      priority: 2,
    };
  }

  return {
    type: "healthy",
    label: "No action needed",
    description: "Domain routing, verification, and SSL look healthy.",
    priority: 3,
  };
}

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

    const normalizedDomains = domains.map((domain) => {
      const verificationStatus = getEffectiveVerificationStatus({
        isConnected: domain.isConnected,
        verificationStatus: domain.verificationStatus,
        verifiedAt: domain.verifiedAt,
      });

      return {
        ...domain,
        verificationStatus,
        nameserverList: safeParseNameservers(domain.nameservers),
        daysUntilExpiry: daysUntil(domain.expiresAt),
        nextAction: buildDomainAction({ ...domain, verificationStatus }),
      };
    });

    const needsAction = normalizedDomains.filter((domain) => domain.nextAction.priority === 1).length;
    const expiringSoon = normalizedDomains.filter((domain) => {
      const days = domain.daysUntilExpiry;
      return days !== null && days <= 30;
    }).length;

    return NextResponse.json({
      success: true,
      data: {
        domains: normalizedDomains,
        summary: {
          total: normalizedDomains.length,
          registered: normalizedDomains.filter((domain) => !domain.isConnected).length,
          connected: normalizedDomains.filter((domain) => domain.isConnected).length,
          primary: normalizedDomains.find((domain) => domain.isPrimary)?.domainName || null,
          verified: normalizedDomains.filter((domain) => domain.verificationStatus === "verified").length,
          sslReady: normalizedDomains.filter((domain) => domain.sslStatus === "active" || domain.sslStatus === "active_certificate").length,
          needsAction,
          expiringSoon,
        },
        setupSteps: [
          {
            id: "choose",
            label: "Choose domain",
            description: "Register a new domain or connect one you already own.",
            completed: normalizedDomains.length > 0,
          },
          {
            id: "verify",
            label: "Verify ownership",
            description: "Connected domains require a TXT record before routing can be trusted.",
            completed: normalizedDomains.length > 0 && needsAction === 0,
          },
          {
            id: "route",
            label: "Route traffic",
            description: "Use FlowSmartly nameservers or DNS records so the domain reaches the right website.",
            completed: normalizedDomains.some((domain) => domain.sslStatus === "active" || domain.sslStatus === "active_certificate"),
          },
          {
            id: "protect",
            label: "Protect renewal",
            description: "Keep WHOIS privacy and auto-renew on for production domains.",
            completed: normalizedDomains.length > 0 && normalizedDomains.every((domain) => domain.autoRenew || domain.isConnected),
          },
        ],
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
