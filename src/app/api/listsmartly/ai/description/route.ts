import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { generateListingDescription } from "@/lib/listsmartly/ai-descriptions";

/**
 * POST /api/listsmartly/ai/description
 * Generate an AI-optimized listing description for a specific listing or directory.
 *
 * Body: { listingId?: string, directoryId?: string }
 * At least one must be provided. If listingId is given, it takes priority.
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

    const body = await req.json();
    const { listingId, directoryId } = body;

    if (!listingId && !directoryId) {
      return NextResponse.json(
        { success: false, error: { message: "listingId or directoryId is required" } },
        { status: 400 }
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

    // Resolve the listing
    let listing;
    if (listingId) {
      listing = await prisma.businessListing.findFirst({
        where: { id: listingId, profileId: profile.id },
        include: { directory: { select: { name: true } } },
      });
    } else {
      listing = await prisma.businessListing.findFirst({
        where: { directoryId, profileId: profile.id },
        include: { directory: { select: { name: true } } },
      });
    }

    if (!listing) {
      return NextResponse.json(
        { success: false, error: { message: "Listing not found" } },
        { status: 404 }
      );
    }

    // Check credits
    const creditCost = await getDynamicCreditCost("AI_LISTING_DESCRIPTION");
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    const isAdmin = !!session.adminId;
    if (!isAdmin && (!user || user.aiCredits < creditCost)) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Insufficient credits" },
          required: creditCost,
          available: user?.aiCredits || 0,
        },
        { status: 402 }
      );
    }

    // Generate description
    const description = await generateListingDescription({
      businessName: profile.businessName,
      industry: profile.industry || undefined,
      description: profile.description || undefined,
      directoryName: listing.directory.name,
    });

    // Update listing
    await prisma.businessListing.update({
      where: { id: listing.id },
      data: { aiDescription: description },
    });

    // Deduct credits
    if (!isAdmin) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: creditCost } },
      });

      await prisma.creditTransaction.create({
        data: {
          userId: session.userId,
          amount: -creditCost,
          type: "USAGE",
          balanceAfter: (user?.aiCredits || 0) - creditCost,
          description: `AI listing description for ${listing.directory.name}`,
          referenceType: "ai_listing_description",
          referenceId: listing.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        description,
        listingId: listing.id,
        creditsUsed: creditCost,
        creditsRemaining: (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    console.error("[ListSmartly] AI description error:", error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Failed to generate description" } },
      { status: 500 }
    );
  }
}
