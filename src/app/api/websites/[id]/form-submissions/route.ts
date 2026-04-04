import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// GET /api/websites/[id]/form-submissions
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({ where: { id, userId: session.userId, deletedAt: null }, select: { id: true } });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = 50;
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      prisma.websiteFormSubmission.findMany({ where: { websiteId: id }, orderBy: { createdAt: "desc" }, skip, take: limit }),
      prisma.websiteFormSubmission.count({ where: { websiteId: id } }),
    ]);

    return NextResponse.json({ submissions, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("GET form-submissions error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
