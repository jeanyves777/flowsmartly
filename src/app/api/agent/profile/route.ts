import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const profile = await prisma.agentProfile.findUnique({
      where: { userId: session.userId },
      include: {
        _count: { select: { clients: true, warnings: true } },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "No agent profile found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { profile } });
  } catch (error) {
    console.error("Get agent profile error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Check if profile already exists
    const existing = await prisma.agentProfile.findUnique({
      where: { userId: session.userId },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { message: "Agent profile already exists" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { displayName, bio, specialties, industries, portfolioUrls, minPricePerMonth, includeFlowProfile } = body;

    if (!displayName) {
      return NextResponse.json(
        { success: false, error: { message: "Display name is required" } },
        { status: 400 }
      );
    }

    // Enforce $100/month minimum
    const price = minPricePerMonth || 10000;
    if (price < 10000) {
      return NextResponse.json(
        { success: false, error: { message: "Minimum price is $100/month" } },
        { status: 400 }
      );
    }

    // Generate landing page slug from display name if FlowSmartly profile is included
    let landingPageSlug: string | null = null;
    if (includeFlowProfile) {
      const baseSlug = displayName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);

      // Ensure slug is unique
      let slug = baseSlug;
      let counter = 1;
      while (true) {
        const existingSlug = await prisma.agentProfile.findUnique({
          where: { landingPageSlug: slug },
          select: { id: true },
        });
        if (!existingSlug) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      landingPageSlug = slug;
    }

    // Filter out the placeholder "flowsmartly-profile" from portfolio URLs
    const cleanPortfolioUrls = (portfolioUrls || []).filter(
      (u: string) => u && u !== "flowsmartly-profile"
    );

    const profile = await prisma.agentProfile.create({
      data: {
        userId: session.userId,
        displayName,
        bio: bio || null,
        specialties: JSON.stringify(specialties || []),
        industries: JSON.stringify(industries || []),
        portfolioUrls: JSON.stringify(cleanPortfolioUrls),
        minPricePerMonth: price,
        landingPageSlug,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, data: { profile } }, { status: 201 });
  } catch (error) {
    console.error("Create agent profile error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const profile = await prisma.agentProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "No agent profile found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.displayName !== undefined) updates.displayName = body.displayName;
    if (body.bio !== undefined) updates.bio = body.bio;
    if (body.specialties !== undefined) updates.specialties = JSON.stringify(body.specialties);
    if (body.industries !== undefined) updates.industries = JSON.stringify(body.industries);
    if (body.portfolioUrls !== undefined) updates.portfolioUrls = JSON.stringify(body.portfolioUrls);
    if (body.coverImageUrl !== undefined) updates.coverImageUrl = body.coverImageUrl;
    if (body.showcaseImages !== undefined) {
      updates.showcaseImages = JSON.stringify(body.showcaseImages);
    }
    if (body.minPricePerMonth !== undefined) {
      if (body.minPricePerMonth < 10000) {
        return NextResponse.json(
          { success: false, error: { message: "Minimum price is $100/month" } },
          { status: 400 }
        );
      }
      updates.minPricePerMonth = body.minPricePerMonth;
    }
    if (body.landingPageSlug !== undefined) updates.landingPageSlug = body.landingPageSlug;
    if (body.landingPageData !== undefined) updates.landingPageData = JSON.stringify(body.landingPageData);

    const updated = await prisma.agentProfile.update({
      where: { userId: session.userId },
      data: updates,
      include: {
        _count: { select: { clients: true, warnings: true } },
      },
    });

    return NextResponse.json({ success: true, data: { profile: updated } });
  } catch (error) {
    console.error("Update agent profile error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
