import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  generateGoogleShoppingFeed,
  generateFacebookCatalog,
  generateTikTokFeed,
} from "@/lib/ads/product-feeds";

const GENERATORS: Record<string, {
  generator: (storeId: string) => Promise<string>;
  contentType: string;
}> = {
  google_shopping: {
    generator: generateGoogleShoppingFeed,
    contentType: "application/xml; charset=utf-8",
  },
  facebook_catalog: {
    generator: generateFacebookCatalog,
    contentType: "application/json; charset=utf-8",
  },
  tiktok: {
    generator: generateTikTokFeed,
    contentType: "text/csv; charset=utf-8",
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;
    const storeSlug = request.nextUrl.searchParams.get("store");

    if (!storeSlug) {
      return new NextResponse("Missing store parameter", { status: 400 });
    }

    const config = GENERATORS[platform];
    if (!config) {
      return new NextResponse("Invalid platform", { status: 400 });
    }

    const store = await prisma.store.findUnique({
      where: { slug: storeSlug },
      select: { id: true, isActive: true },
    });

    if (!store || !store.isActive) {
      return new NextResponse("Store not found", { status: 404 });
    }

    const content = await config.generator(store.id);

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": config.contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Serve feed error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
