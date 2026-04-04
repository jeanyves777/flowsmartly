import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { checkConsistency } from "@/lib/listsmartly/consistency-checker";
import { recordChange } from "@/lib/listsmartly/bulk-operations";

/**
 * POST /api/listsmartly/ai/auto-fix
 * Run consistency check on all live listings and auto-fix inconsistencies
 * by updating each listing to match the master profile.
 *
 * Deducts 2 credits per fix (AI_AUTO_FIX).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Fetch profile
    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    // Get credit cost per fix
    const creditPerFix = await getDynamicCreditCost("AI_AUTO_FIX");

    // Find all live/submitted/claimed listings
    const listings = await prisma.businessListing.findMany({
      where: {
        profileId: profile.id,
        status: { in: ["live", "submitted", "claimed"] },
      },
      include: { directory: { select: { name: true } } },
    });

    // Check user credits upfront (estimate: all listings might need fixing)
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });
    const isAdmin = !!session.adminId;

    const changes: Array<{
      listingId: string;
      directoryName: string;
      field: string;
      oldValue: string;
      newValue: string;
    }> = [];

    let fixed = 0;
    let creditsUsed = 0;

    for (const listing of listings) {
      const result = checkConsistency(profile, listing);

      if (result.isConsistent) continue;

      // Check if user can afford this fix
      if (!isAdmin) {
        const remainingCredits = (user?.aiCredits || 0) - creditsUsed;
        if (remainingCredits < creditPerFix) break; // Stop if out of credits
      }

      // Apply fixes: update listing fields to match profile
      const updateData: Record<string, string | null | Date> = {};

      for (const inconsistency of result.inconsistencies) {
        const field = inconsistency.field as keyof typeof updateData;
        updateData[field] = inconsistency.expected;

        // Record the change for audit trail
        await recordChange(
          listing.id,
          inconsistency.field,
          inconsistency.actual,
          inconsistency.expected,
          "ai_auto_fix",
          "auto_fix"
        );

        changes.push({
          listingId: listing.id,
          directoryName: listing.directory.name,
          field: inconsistency.field,
          oldValue: inconsistency.actual,
          newValue: inconsistency.expected,
        });
      }

      // Update the listing
      await prisma.businessListing.update({
        where: { id: listing.id },
        data: {
          ...updateData,
          isConsistent: true,
          inconsistencies: "[]",
          lastUpdatedAt: new Date(),
        },
      });

      fixed++;
      creditsUsed += creditPerFix;
    }

    // Deduct all credits at once
    if (!isAdmin && creditsUsed > 0) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: creditsUsed } },
      });

      await prisma.creditTransaction.create({
        data: {
          userId: session.userId,
          amount: -creditsUsed,
          type: "USAGE",
          balanceAfter: (user?.aiCredits || 0) - creditsUsed,
          description: `AI auto-fix: ${fixed} listing(s) corrected`,
          referenceType: "ai_auto_fix",
          referenceId: profile.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        fixed,
        totalChecked: listings.length,
        creditsUsed,
        creditsRemaining: (user?.aiCredits || 0) - creditsUsed,
        changes,
      },
    });
  } catch (error) {
    console.error("[ListSmartly] AI auto-fix error:", error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Auto-fix failed" } },
      { status: 500 }
    );
  }
}
