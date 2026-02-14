import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// POST /api/ads/ad-pages/[slug]/click - Track click on ad page CTA
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const adPage = await prisma.adPage.findFirst({
      where: { slug, status: "ACTIVE" },
      select: { id: true, destinationUrl: true },
    });

    if (!adPage) {
      return NextResponse.json(
        { success: false, error: { message: "Ad page not found" } },
        { status: 404 }
      );
    }

    // Increment click counts (fire-and-forget)
    await Promise.all([
      prisma.adPage.update({
        where: { id: adPage.id },
        data: { clicks: { increment: 1 } },
      }),
      prisma.adCampaign.updateMany({
        where: { adPageId: adPage.id, status: "ACTIVE" },
        data: { clicks: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { redirectUrl: adPage.destinationUrl },
    });
  } catch (error) {
    console.error("Ad page click tracking error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to track click" } },
      { status: 500 }
    );
  }
}
