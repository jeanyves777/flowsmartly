import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET — list ad campaigns linked to user's store
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {
      sourceStoreId: store.id,
    };

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    const campaigns = await prisma.adCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        adType: true,
        approvalStatus: true,
        budgetCents: true,
        spentCents: true,
        impressions: true,
        clicks: true,
        revenueTrackedCents: true,
        adOrderCount: true,
        sourceProductId: true,
        headline: true,
        mediaUrl: true,
        createdAt: true,
      },
    });

    // Fetch product names
    const productIds = campaigns
      .map((c) => c.sourceProductId)
      .filter((id): id is string => !!id);

    const products = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, images: true },
        })
      : [];

    const productMap = new Map(
      products.map((p) => {
        let imageUrl: string | null = null;
        try {
          const imgs = JSON.parse(p.images as string || "[]");
          imageUrl = imgs[0]?.url || null;
        } catch {}
        return [p.id, { name: p.name, imageUrl }];
      })
    );

    const formatted = campaigns.map((c) => {
      const product = c.sourceProductId ? productMap.get(c.sourceProductId) : null;
      const roas = c.spentCents > 0 ? c.revenueTrackedCents / c.spentCents : 0;

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        adType: c.adType,
        approvalStatus: c.approvalStatus,
        budgetCents: c.budgetCents,
        spentCents: c.spentCents,
        impressions: c.impressions,
        clicks: c.clicks,
        revenueCents: c.revenueTrackedCents,
        orderCount: c.adOrderCount,
        roas: Math.round(roas * 100) / 100,
        productName: product?.name || null,
        productImage: product?.imageUrl || null,
        headline: c.headline,
        mediaUrl: c.mediaUrl,
        createdAt: c.createdAt.toISOString(),
      };
    });

    return NextResponse.json(await presignAllUrls({ campaigns: formatted }));
  } catch (error) {
    console.error("E-commerce ads listing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
