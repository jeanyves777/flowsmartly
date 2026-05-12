import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const posts = await prisma.websiteBlogPost.findMany({
      where: { websiteId: id, userId: session.userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, posts });
  } catch (error) {
    console.error("GET /api/websites/[id]/blog-posts error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
