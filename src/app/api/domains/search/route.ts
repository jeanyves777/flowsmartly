import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { searchDomains } from "@/lib/domains/manager";

/**
 * POST /api/domains/search
 * Search for available domains across supported TLDs.
 * Auth is optional — allows anonymous domain search.
 *
 * `isFreeEligible` on each result is the SOURCE OF TRUTH for the FREE badge
 * — clients must NOT decide eligibility themselves. We narrow the TLD-level
 * flag returned by searchDomains with the calling user's actual state:
 *   • user is signed in
 *   • user has an active Pro store subscription
 *   • user hasn't already claimed their free domain
 * For anonymous callers `isFreeEligible` is forced false (a FREE offer
 * doesn't apply to a non-customer). Until TRULY_FREE_TLDS in pricing.ts is
 * populated, the TLD-level flag is already false, so this collapses to
 * "never advertise FREE" by default.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = body.query as string | undefined;
    const tlds = body.tlds as string[] | undefined;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_QUERY", message: "A non-empty search query is required" } },
        { status: 400 }
      );
    }

    const results = await searchDomains(query, tlds);

    // User-level eligibility check. Anonymous / starter / non-Pro / already-
    // claimed users see every TLD as non-free regardless of what the TLD-
    // level flag says.
    let userEligibleForFree = false;
    try {
      const session = await getSession();
      if (session?.userId) {
        const store = await prisma.store.findUnique({
          where: { userId: session.userId },
          select: {
            ecomPlan: true,
            ecomSubscriptionStatus: true,
            freeDomainClaimed: true,
          },
        });
        const subActive =
          store?.ecomSubscriptionStatus === "active" ||
          store?.ecomSubscriptionStatus === "trialing";
        userEligibleForFree = !!store && store.ecomPlan === "pro" && subActive && !store.freeDomainClaimed;
      }
    } catch {
      // Treat any session/db hiccup as "not eligible for free".
      userEligibleForFree = false;
    }

    const gated = results.map((r) => ({
      ...r,
      isFreeEligible: r.isFreeEligible && userEligibleForFree,
    }));

    return NextResponse.json({
      success: true,
      data: { results: gated },
    });
  } catch (error) {
    console.error("Domain search error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SEARCH_FAILED", message: "Domain search failed" } },
      { status: 500 }
    );
  }
}
