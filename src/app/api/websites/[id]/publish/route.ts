import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// POST /api/websites/[id]/publish — Publish website
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({ where: { id, userId: session.userId, deletedAt: null }, select: { id: true, publishedVersion: true } });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Publish the website and all its pages
    await prisma.$transaction([
      prisma.website.update({
        where: { id },
        data: { status: "PUBLISHED", publishedAt: new Date(), publishedVersion: website.publishedVersion + 1 },
      }),
      prisma.websitePage.updateMany({
        where: { websiteId: id, status: "DRAFT" },
        data: { status: "PUBLISHED" },
      }),
    ]);

    return NextResponse.json({ success: true, version: website.publishedVersion + 1 });
  } catch (err) {
    console.error("POST /api/websites/[id]/publish error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
