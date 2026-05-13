import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { buildListSmartlyAccess, requiresListSmartlyPaymentBackup } from "@/lib/listsmartly/billing";
import { getListSmartlyPaymentBackup } from "@/lib/listsmartly/payment-backup";

// GET /api/listsmartly/profile - Fetch user's ListSmartly profile
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const [profile, user] = await Promise.all([
      prisma.listSmartlyProfile.findUnique({
        where: { userId: session.userId },
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { plan: true, aiCredits: true, deletedAt: true, stripeCustomerId: true },
      }),
    ]);

    const backupPaymentRequired = requiresListSmartlyPaymentBackup(user || null);
    const paymentBackup = backupPaymentRequired
      ? await getListSmartlyPaymentBackup(user?.stripeCustomerId)
      : { ready: true, paymentMethodId: null, label: null, reason: null };

    // Fetch brand kit as fallback data source
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        profile: profile
          ? {
              ...profile,
              categories: JSON.parse(profile.categories),
              hours: JSON.parse(profile.hours),
              photos: JSON.parse(profile.photos),
              socialLinks: JSON.parse(profile.socialLinks),
            }
          : null,
        brandKit: brandKit
          ? {
              name: brandKit.name,
              industry: brandKit.industry,
              email: brandKit.email,
              phone: brandKit.phone,
              website: brandKit.website,
              address: brandKit.address,
              description: brandKit.description,
            }
          : null,
        access: buildListSmartlyAccess(profile, {
          ...(user || {}),
          paymentBackupReady: paymentBackup.ready,
          paymentBackupLabel: paymentBackup.label,
          paymentBackupReason: paymentBackup.reason,
        }),
      },
    });
  } catch (error) {
    console.error("Get ListSmartly profile error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch profile" } },
      { status: 500 }
    );
  }
}

// PUT /api/listsmartly/profile - Update ListSmartly profile
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();

    // If syncFromBrandKit flag is set, pull data from brand kit
    if (body.syncFromBrandKit) {
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId, isDefault: true },
      });
      if (brandKit) {
        body.businessName = body.businessName || brandKit.name;
        body.phone = body.phone || brandKit.phone;
        body.email = body.email || brandKit.email;
        body.website = body.website || brandKit.website;
        body.address = body.address || brandKit.address;
        body.industry = body.industry || brandKit.industry;
        body.description = body.description || brandKit.description;
      }
    }

    const allowedFields = [
      "businessName", "phone", "email", "website", "address",
      "city", "state", "zip", "country", "industry", "categories",
      "description", "shortDescription", "hours", "serviceArea",
      "yearFounded", "socialLinks", "setupComplete",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "categories" || field === "hours" || field === "socialLinks") {
          updateData[field] = typeof body[field] === "string"
            ? body[field]
            : JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await prisma.listSmartlyProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          ...updated,
          categories: JSON.parse(updated.categories),
          hours: JSON.parse(updated.hours),
          photos: JSON.parse(updated.photos),
          socialLinks: JSON.parse(updated.socialLinks),
        },
      },
    });
  } catch (error) {
    console.error("Update ListSmartly profile error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update profile" } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  return PUT(request);
}

// DELETE /api/listsmartly/profile - Remove ListSmartly profile data
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    await prisma.listSmartlyProfile.deleteMany({
      where: { userId: session.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete ListSmartly profile error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete profile" } },
      { status: 500 }
    );
  }
}
