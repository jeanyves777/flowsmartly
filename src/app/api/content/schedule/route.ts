import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { enumerateCampaignAutomationOccurrences } from "@/lib/content/campaign-calendar";

type CalendarOverrides = Record<string, { startTime?: string; endTime?: string }>;

function parseCalendarOverrides(value?: string | null): CalendarOverrides {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// GET /api/content/schedule - Fetch all scheduled posts for a given month
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
    const month = searchParams.get("month"); // YYYY-MM format
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if ((!startParam || !endParam) && (!month || !/^\d{4}-\d{2}$/.test(month))) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message:
              "month query parameter is required in YYYY-MM format (e.g. 2026-02)",
          },
        },
        { status: 400 }
      );
    }

    const [year, monthNum] = (month || new Date().toISOString().slice(0, 7)).split("-").map(Number);
    const rangeStart = startParam ? new Date(`${startParam}T00:00:00.000`) : new Date(year, monthNum - 1, 1);
    const rangeEnd = endParam ? new Date(`${endParam}T23:59:59.999`) : new Date(year, monthNum, 0, 23, 59, 59, 999);

    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeEnd < rangeStart) {
      return NextResponse.json(
        { success: false, error: { message: "start and end must be valid date range values" } },
        { status: 400 }
      );
    }

    const [posts, automationOccurrences, strategyTasks] = await Promise.all([
      prisma.post.findMany({
        where: {
          userId: session.userId,
          status: "SCHEDULED",
          scheduledAt: {
            gte: rangeStart,
            lte: rangeEnd,
          },
          deletedAt: null,
        },
        orderBy: { scheduledAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
      enumerateCampaignAutomationOccurrences(session.userId, rangeStart, rangeEnd),
      prisma.strategyTask.findMany({
        where: {
          OR: [
            {
              dueDate: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
            {
              startDate: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
            {
              AND: [
                { startDate: { lte: rangeStart } },
                { dueDate: { gte: rangeEnd } },
              ],
            },
          ],
          strategy: {
            userId: session.userId,
            status: "ACTIVE",
          },
        },
        orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
        include: {
          strategy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // Guarantee mediaUrls and platforms are ARRAYS no matter what's in the
    // DB. Malformed JSON or accidentally-stored objects in mediaMeta /
    // platforms would crash the client at render (it calls .filter on
    // these), so we Array.isArray-check before passing through.
    const safeMediaUrls = (mediaMeta: string | null, mediaUrl: string | null): string[] => {
      if (mediaMeta) {
        try {
          const parsed = JSON.parse(mediaMeta);
          if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch {
          // fall through to mediaUrl fallback
        }
      }
      return mediaUrl ? [mediaUrl] : [];
    };
    const safePlatforms = (raw: string | null): string[] => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const formattedPosts = posts.map((post) => ({
      id: post.id,
      itemType: "post",
      caption: post.caption,
      mediaUrl: post.mediaUrl,
      mediaUrls: safeMediaUrls(post.mediaMeta, post.mediaUrl),
      mediaThumbnails: post.thumbnailUrl ? [post.thumbnailUrl] : [],
      mediaType: post.mediaType,
      status: "scheduled",
      platforms: safePlatforms(post.platforms),
      scheduledAt: post.scheduledAt?.toISOString() || null,
      user: {
        id: post.user.id,
        name: post.user.name,
        username: post.user.username,
        avatarUrl: post.user.avatarUrl,
      },
      createdAt: post.createdAt.toISOString(),
    }));

    const formattedStrategyItems = strategyTasks.map((task) => ({
      id: task.id,
      itemType: "strategy",
      caption: task.title,
      title: task.title,
      description: task.description || null,
      mediaUrl: null,
      mediaUrls: [],
      mediaThumbnails: [],
      mediaType: null,
      status: task.status.toLowerCase(),
      platforms: ["strategy"],
      scheduledAt: task.dueDate?.toISOString() || task.startDate?.toISOString() || null,
      publishedAt: null,
      createdAt: task.createdAt.toISOString(),
      startDate: task.startDate?.toISOString() || null,
      dueDate: task.dueDate?.toISOString() || null,
      priority: task.priority,
      category: task.category,
      calendarOverrides: parseCalendarOverrides(task.calendarOverrides),
      strategyName: task.strategy.name,
      strategyId: task.strategy.id,
      progress: task.progress,
    }));

    const formattedAutomationItems = automationOccurrences.map((occ) => ({
      id: occ.id,
      itemType: "automation" as const,
      caption: occ.itemName,
      title: occ.itemName,
      description: occ.topic,
      mediaUrl: null,
      mediaUrls: [],
      mediaThumbnails: [],
      mediaType: null,
      status: "scheduled",
      platforms: occ.platforms,
      scheduledAt: occ.scheduledAt,
      publishedAt: null,
      createdAt: occ.scheduledAt,
      automationId: occ.automationId,
      campaignId: occ.campaignId,
      campaignName: occ.campaignName,
      reviewStatus: occ.reviewStatus,
      triggerType: occ.triggerType,
      mediaMode: occ.mediaMode,
    }));

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        posts: formattedPosts,
        strategyItems: formattedStrategyItems,
        automationItems: formattedAutomationItems,
        items: [
          ...formattedPosts,
          ...formattedStrategyItems,
          ...formattedAutomationItems,
        ].sort((a, b) => {
          const aTime = new Date(a.scheduledAt || a.createdAt).getTime();
          const bTime = new Date(b.scheduledAt || b.createdAt).getTime();
          return aTime - bTime;
        }),
        month: month || `${year}-${String(monthNum).padStart(2, "0")}`,
        range: {
          start: rangeStart.toISOString(),
          end: rangeEnd.toISOString(),
        },
        totalScheduled: formattedPosts.length,
        totalStrategyItems: formattedStrategyItems.length,
        totalAutomationItems: formattedAutomationItems.length,
      }),
    });
  } catch (error) {
    console.error("Get scheduled posts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch scheduled posts" } },
      { status: 500 }
    );
  }
}

// PATCH /api/content/schedule - Reschedule a post
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { postId, scheduledAt } = body;

    if (!postId) {
      return NextResponse.json(
        { success: false, error: { message: "postId is required" } },
        { status: 400 }
      );
    }

    if (!scheduledAt) {
      return NextResponse.json(
        { success: false, error: { message: "scheduledAt is required" } },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Invalid date format for scheduledAt" },
        },
        { status: 400 }
      );
    }

    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "scheduledAt must be in the future" },
        },
        { status: 400 }
      );
    }

    // Find the post and validate ownership
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, status: true, caption: true, platforms: true },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    if (post.userId !== session.userId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Not authorized to reschedule this post" },
        },
        { status: 403 }
      );
    }

    const start = new Date(scheduledDate);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 60_000);
    const duplicate = await prisma.post.findFirst({
      where: {
        id: { not: postId },
        userId: session.userId,
        status: "SCHEDULED",
        deletedAt: null,
        scheduledAt: { gte: start, lt: end },
        platforms: post.platforms,
        caption: post.caption,
      },
      select: { id: true, scheduledAt: true, status: true },
    });

    if (duplicate) {
      return NextResponse.json({
        success: true,
        data: {
          duplicateSkipped: true,
          post: {
            id: duplicate.id,
            scheduledAt: duplicate.scheduledAt?.toISOString() || null,
            status: duplicate.status,
          },
        },
      });
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        scheduledAt: scheduledDate,
        status: "SCHEDULED",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        post: {
          id: updatedPost.id,
          scheduledAt: updatedPost.scheduledAt?.toISOString() || null,
          status: updatedPost.status,
        },
      },
    });
  } catch (error) {
    console.error("Reschedule post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to reschedule post" } },
      { status: 500 }
    );
  }
}
