import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/ai-jobs - List AI generation jobs, including Story Ad Movie.
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";

    const cartoonWhere: Record<string, unknown> = {};
    if (status) cartoonWhere.status = status;
    if (type === "story-ad-movie") cartoonWhere.metadata = { contains: "story_ad_movie" };
    if (search) {
      cartoonWhere.OR = [
        { storyPrompt: { contains: search } },
        { currentStep: { contains: search } },
      ];
    }

    const [cartoons, cartoonTotal, cartoonStats] = await Promise.all([
      prisma.cartoonVideo.findMany({
        where: cartoonWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.cartoonVideo.count({ where: cartoonWhere }),
      Promise.all([
        prisma.cartoonVideo.count({ where: cartoonWhere }),
        prisma.cartoonVideo.count({ where: { ...cartoonWhere, status: "COMPLETED" } }),
        prisma.cartoonVideo.count({ where: { ...cartoonWhere, status: "PROCESSING" } }),
        prisma.cartoonVideo.count({ where: { ...cartoonWhere, status: "FAILED" } }),
        prisma.cartoonVideo.aggregate({ where: cartoonWhere, _sum: { creditsCost: true } }),
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        jobs: cartoons.map((c) => ({
          id: c.id,
          type: c.metadata?.includes("story_ad_movie") ? "story_ad_movie" : "legacy_cartoon",
          storyPrompt: c.storyPrompt?.substring(0, 100) + (c.storyPrompt && c.storyPrompt.length > 100 ? "..." : ""),
          style: c.style,
          animationType: c.animationType,
          status: c.status,
          progress: c.progress,
          currentStep: c.currentStep,
          errorMessage: c.errorMessage,
          creditsCost: c.creditsCost,
          videoUrl: c.videoUrl,
          createdAt: c.createdAt.toISOString(),
          user: c.user,
          project: c.project,
        })),
        pagination: { page, limit, total: cartoonTotal, totalPages: Math.ceil(cartoonTotal / limit) },
        stats: {
          total: cartoonStats[0],
          completed: cartoonStats[1],
          processing: cartoonStats[2],
          failed: cartoonStats[3],
          totalCreditsUsed: cartoonStats[4]._sum.creditsCost || 0,
        },
      },
    });
  } catch (error) {
    console.error("Admin AI jobs error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch AI jobs" } }, { status: 500 });
  }
}
