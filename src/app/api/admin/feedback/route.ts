import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { AdminPermission, getAdminSession, requirePermission } from "@/lib/admin/auth";
import { presignAllUrls } from "@/lib/utils/s3-client";

const statuses = ["NEW", "TRIAGED", "IN_PROGRESS", "RESOLVED", "ARCHIVED"] as const;
const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
type FeedbackStatus = (typeof statuses)[number];
type FeedbackPriority = (typeof priorities)[number];

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function serializeReport(report: {
  id: string;
  referenceCode: string;
  userId: string;
  category: string;
  message: string;
  screenshotUrls: string;
  pageUrl: string | null;
  userAgent: string | null;
  viewport: string | null;
  status: string;
  priority: string;
  adminNotes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    username: string;
    plan: string;
  };
}) {
  const data = {
    ...report,
    screenshotUrls: parseJsonArray(report.screenshotUrls),
    resolvedAt: report.resolvedAt?.toISOString() || null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
  return presignAllUrls(data);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    const denied = requirePermission(session, AdminPermission.VIEW_CONTENT);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim().toUpperCase() || "";
    const category = searchParams.get("category")?.trim().toUpperCase() || "";

    const where: Record<string, unknown> = {};
    if (statuses.includes(status as FeedbackStatus)) {
      where.status = status;
    }
    if (category) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { referenceCode: { contains: search } },
        { message: { contains: search } },
        { pageUrl: { contains: search } },
        { user: { is: { name: { contains: search } } } },
        { user: { is: { email: { contains: search } } } },
        { user: { is: { username: { contains: search } } } },
      ];
    }

    const [reports, total, stats, categories] = await Promise.all([
      prisma.feedbackReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              plan: true,
            },
          },
        },
      }),
      prisma.feedbackReport.count({ where }),
      Promise.all([
        prisma.feedbackReport.count(),
        prisma.feedbackReport.count({ where: { status: "NEW" } }),
        prisma.feedbackReport.count({ where: { status: "IN_PROGRESS" } }),
        prisma.feedbackReport.count({ where: { status: "RESOLVED" } }),
        prisma.feedbackReport.count({ where: { priority: "URGENT" } }),
      ]),
      prisma.feedbackReport.findMany({
        distinct: ["category"],
        select: { category: true },
        orderBy: { category: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        reports: await Promise.all(reports.map(serializeReport)),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: {
          total: stats[0],
          new: stats[1],
          inProgress: stats[2],
          resolved: stats[3],
          urgent: stats[4],
        },
        categories: categories.map((item) => item.category),
        statuses,
        priorities,
      },
    });
  } catch (error) {
    console.error("Admin feedback reports error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch feedback reports" } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession();
    const denied = requirePermission(session, AdminPermission.VIEW_CONTENT);
    if (denied) return denied;

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const status = typeof body.status === "string" ? body.status.toUpperCase() : undefined;
    const priority = typeof body.priority === "string" ? body.priority.toUpperCase() : undefined;
    const adminNotes = typeof body.adminNotes === "string" ? body.adminNotes.trim() : undefined;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Feedback report id is required" } },
        { status: 400 }
      );
    }
    if (status && !statuses.includes(status as FeedbackStatus)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid feedback status" } },
        { status: 400 }
      );
    }
    if (priority && !priorities.includes(priority as FeedbackPriority)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid feedback priority" } },
        { status: 400 }
      );
    }

    const updateData: {
      status?: FeedbackStatus;
      priority?: FeedbackPriority;
      adminNotes?: string | null;
      resolvedAt?: Date | null;
    } = {};
    if (status) {
      updateData.status = status as FeedbackStatus;
      updateData.resolvedAt = status === "RESOLVED" ? new Date() : null;
    }
    if (priority) updateData.priority = priority as FeedbackPriority;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes || null;

    const updated = await prisma.feedbackReport.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            plan: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { report: await serializeReport(updated) },
    });
  } catch (error) {
    console.error("Update feedback report error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update feedback report" } },
      { status: 500 }
    );
  }
}
