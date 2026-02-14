import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/admin/media - List all media (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.adminId) {
      return NextResponse.json({ success: false, error: { message: "Admin access required" } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const cursor = searchParams.get("cursor");

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;
    if (search) where.originalName = { contains: search };

    const files = await prisma.mediaFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        folder: { select: { id: true, name: true } },
      },
    });

    const hasMore = files.length > limit;
    const result = hasMore ? files.slice(0, limit) : files;

    // Get aggregate stats
    const [totalFiles, totalSize, typeBreakdown] = await Promise.all([
      prisma.mediaFile.count({ where }),
      prisma.mediaFile.aggregate({ where, _sum: { size: true } }),
      prisma.mediaFile.groupBy({ by: ["type"], where, _count: true }),
    ]);

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        files: result.map((f) => ({
          id: f.id,
          originalName: f.originalName,
          url: f.url,
          type: f.type,
          mimeType: f.mimeType,
          size: f.size,
          folderId: f.folderId,
          folder: f.folder,
          user: f.user,
          tags: JSON.parse(f.tags),
          createdAt: f.createdAt.toISOString(),
        })),
        stats: {
          totalFiles,
          totalSize: totalSize._sum.size || 0,
          typeBreakdown: typeBreakdown.map((t) => ({ type: t.type, count: t._count })),
        },
        hasMore,
        nextCursor: hasMore ? result[result.length - 1]?.id : null,
      }),
    });
  } catch (error) {
    console.error("Admin get media error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch media" } }, { status: 500 });
  }
}
