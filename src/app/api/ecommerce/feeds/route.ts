import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  generateGoogleShoppingFeed,
  generateFacebookCatalog,
  generateTikTokFeed,
} from "@/lib/ads/product-feeds";

const PLATFORM_CONFIG: Record<string, { format: string; generator: (storeId: string) => Promise<string> }> = {
  google_shopping: { format: "xml", generator: generateGoogleShoppingFeed },
  facebook_catalog: { format: "json", generator: generateFacebookCatalog },
  tiktok: { format: "csv", generator: generateTikTokFeed },
};

// GET — list all feeds for the user's store
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await prisma.store.findFirst({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const feeds = await prisma.productFeed.findMany({
      where: { storeId: store.id },
      orderBy: { platform: "asc" },
    });

    return NextResponse.json({ feeds });
  } catch (error) {
    console.error("List feeds error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — generate/regenerate a feed
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { platform } = body;

    if (!platform || !PLATFORM_CONFIG[platform]) {
      return NextResponse.json(
        { error: "Invalid platform. Must be google_shopping, facebook_catalog, or tiktok" },
        { status: 400 }
      );
    }

    const store = await prisma.store.findFirst({
      where: { userId: session.userId },
      select: { id: true, slug: true },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    try {
      const config = PLATFORM_CONFIG[platform];

      // Generate the feed content
      await config.generator(store.id);

      // Count active products
      const productCount = await prisma.product.count({
        where: { storeId: store.id, status: "ACTIVE", deletedAt: null },
      });

      // Build public feed URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
      const feedUrl = `${baseUrl}/api/ecommerce/feeds/${platform}?store=${store.slug}`;

      // Upsert the feed record
      const feed = await prisma.productFeed.upsert({
        where: { storeId_platform: { storeId: store.id, platform } },
        create: {
          storeId: store.id,
          platform,
          feedFormat: config.format,
          feedUrl,
          productCount,
          status: "synced",
          lastSyncedAt: new Date(),
        },
        update: {
          feedUrl,
          productCount,
          status: "synced",
          lastSyncedAt: new Date(),
          errorMessage: null,
        },
      });

      return NextResponse.json({ feed });
    } catch (err) {
      // Save error state
      await prisma.productFeed.upsert({
        where: { storeId_platform: { storeId: store.id, platform } },
        create: {
          storeId: store.id,
          platform,
          feedFormat: PLATFORM_CONFIG[platform].format,
          status: "error",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        },
        update: {
          status: "error",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        },
      });

      return NextResponse.json(
        { error: "Failed to generate feed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Generate feed error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
