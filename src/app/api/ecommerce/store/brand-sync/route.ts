import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * POST /api/ecommerce/store/brand-sync
 * Read user's default BrandKit and sync relevant fields to the Store.
 * Extracts: name, description, logoUrl, industry, colors, fonts -> theme JSON.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    // Verify user owns a store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "No store found. Create a store first." } },
        { status: 404 }
      );
    }

    // Find user's default brand kit, or first brand kit
    let brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });

    if (!brandKit) {
      brandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId },
      });
    }

    if (!brandKit) {
      return NextResponse.json(
        { success: false, error: { code: "NO_BRAND_KIT", message: "No brand kit found. Set up your brand identity first." } },
        { status: 404 }
      );
    }

    // Parse BrandKit JSON fields
    let colors: Record<string, string> = {};
    let fonts: Record<string, string> = {};

    try {
      colors = JSON.parse(brandKit.colors || "{}");
    } catch {
      colors = {};
    }

    try {
      fonts = JSON.parse(brandKit.fonts || "{}");
    } catch {
      fonts = {};
    }

    // Build theme JSON from brand kit
    const theme = {
      colors: {
        primary: colors.primary || undefined,
        secondary: colors.secondary || undefined,
        accent: colors.accent || undefined,
      },
      fonts: {
        heading: fonts.heading || undefined,
        body: fonts.body || undefined,
      },
    };

    // Extract description from tagline or description
    const description = brandKit.tagline || brandKit.description || null;

    // Update the Store record
    const updatedStore = await prisma.store.update({
      where: { id: store.id },
      data: {
        name: brandKit.name,
        description,
        logoUrl: brandKit.logo || null,
        industry: brandKit.industry || null,
        theme: JSON.stringify(theme),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        store: {
          ...updatedStore,
          theme: JSON.parse(updatedStore.theme || "{}"),
          settings: JSON.parse(updatedStore.settings || "{}"),
        },
        brandKit: {
          name: brandKit.name,
          tagline: brandKit.tagline,
          description: brandKit.description,
          logo: brandKit.logo,
          industry: brandKit.industry,
          colors,
          fonts,
        },
      },
    });
  } catch (error) {
    console.error("Brand sync error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SYNC_FAILED", message: "Failed to sync brand kit" } },
      { status: 500 }
    );
  }
}
