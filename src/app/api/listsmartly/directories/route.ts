import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// GET /api/listsmartly/directories - List all directories with optional filters
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tier = searchParams.get("tier");
    const category = searchParams.get("category");
    const industry = searchParams.get("industry");

    const where: Record<string, unknown> = { isActive: true };
    if (tier) where.tier = parseInt(tier, 10);
    if (category) where.category = category;

    const directories = await prisma.listingDirectory.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        url: true,
        tier: true,
        category: true,
        industries: true,
        submitUrl: true,
        claimUrl: true,
        apiAvailable: true,
        iconUrl: true,
      },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    });

    // Filter by industry if provided (stored as JSON array)
    const filtered = industry
      ? directories.filter((d) => {
          const industries: string[] = JSON.parse(d.industries || "[]");
          return industries.length === 0 || industries.includes(industry.toLowerCase());
        })
      : directories;

    return NextResponse.json({
      success: true,
      data: {
        directories: filtered.map((d) => ({
          ...d,
          industries: JSON.parse(d.industries || "[]"),
        })),
      },
    });
  } catch (error) {
    console.error("Get directories error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch directories" } },
      { status: 500 }
    );
  }
}
