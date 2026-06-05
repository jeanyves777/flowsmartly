import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { AdminPermission, getAdminSession, requirePermission } from "@/lib/admin/auth";

const SENTIMENTS = ["POSITIVE", "NEGATIVE"] as const;
type Sentiment = (typeof SENTIMENTS)[number];

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    const denied = requirePermission(session, AdminPermission.VIEW_CONTENT);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const sentimentRaw = (searchParams.get("sentiment") || "ALL").trim().toUpperCase();
    const reviewedRaw = (searchParams.get("reviewed") || "false").trim().toLowerCase();

    const where: Record<string, unknown> = {};

    if (SENTIMENTS.includes(sentimentRaw as Sentiment)) {
      where.sentiment = sentimentRaw;
    }

    if (reviewedRaw === "true") {
      where.reviewed = true;
    } else if (reviewedRaw === "false") {
      where.reviewed = false;
    }
    // "all" → no reviewed filter

    if (search) {
      // SQLite (dev) and Postgres (prod) both support contains. We deliberately
      // search the snapshot text too — fine for v1 dataset sizes. If volume
      // grows, switch snapshot search behind a flag and add a GIN index.
      where.OR = [
        { comment: { contains: search } },
        { snapshot: { contains: search } },
        { user: { is: { name: { contains: search } } } },
        { user: { is: { email: { contains: search } } } },
        { user: { is: { username: { contains: search } } } },
      ];
    }

    const [rows, total, pending, positive, negative] = await Promise.all([
      prisma.aIFeedback.findMany({
        where,
        // Unreviewed first when the caller didn't pin a specific reviewed value,
        // otherwise just newest-first within the filter.
        orderBy: [{ reviewed: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              avatarUrl: true,
              oauthAvatarUrl: true,
              plan: true,
            },
          },
        },
      }),
      prisma.aIFeedback.count({ where }),
      prisma.aIFeedback.count({ where: { reviewed: false } }),
      prisma.aIFeedback.count({ where: { sentiment: "POSITIVE" } }),
      prisma.aIFeedback.count({ where: { sentiment: "NEGATIVE" } }),
    ]);

    const serialized = rows.map((row) => {
      let snapshot: unknown = null;
      try {
        snapshot = row.snapshot ? JSON.parse(row.snapshot) : null;
      } catch {
        snapshot = { _raw: row.snapshot };
      }
      return {
        id: row.id,
        userId: row.userId,
        conversationId: row.conversationId,
        messageId: row.messageId,
        sentiment: row.sentiment,
        category: row.category,
        comment: row.comment,
        snapshot,
        reviewed: row.reviewed,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt?.toISOString() || null,
        reviewNote: row.reviewNote,
        createdAt: row.createdAt.toISOString(),
        user: {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
          username: row.user.username,
          avatarUrl: row.user.avatarUrl ?? row.user.oauthAvatarUrl ?? null,
          plan: row.user.plan,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items: serialized,
        counts: {
          total,
          pending,
          byType: {
            POSITIVE: positive,
            NEGATIVE: negative,
          },
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error) {
    console.error("Admin AI feedback list error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "Failed to fetch AI feedback" } },
      { status: 500 }
    );
  }
}
