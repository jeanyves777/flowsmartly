import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { initializeListings } from "@/lib/listsmartly/sync-engine";

// POST /api/listsmartly/activate - Create profile and start trial
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Check if profile already exists
    const existing = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile already exists" } },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { businessName, industry, plan } = body;

    // If no businessName provided, try to get from brand kit or user name
    let name = businessName;
    if (!name) {
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId },
        select: { name: true },
      });
      name = brandKit?.name || null;
    }
    if (!name) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true },
      });
      name = user?.name || "My Business";
    }

    const trialDays = plan === "pro" ? 14 : 30;
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + trialDays);

    const profile = await prisma.listSmartlyProfile.create({
      data: {
        userId: session.userId,
        businessName: name,
        industry: industry || null,
        lsPlan: plan || "basic",
        lsSubscriptionStatus: "trialing",
        freeTrialStartedAt: now,
        freeTrialEndsAt: trialEnd,
      },
    });

    // Initialize listings for matching directories (fire-and-forget)
    initializeListings(profile.id, industry).catch((err) =>
      console.error("Failed to initialize listings:", err)
    );

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          ...profile,
          categories: JSON.parse(profile.categories),
          hours: JSON.parse(profile.hours),
          photos: JSON.parse(profile.photos),
          socialLinks: JSON.parse(profile.socialLinks),
        },
      },
    });
  } catch (error) {
    console.error("Activate ListSmartly error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to activate ListSmartly" } },
      { status: 500 }
    );
  }
}
