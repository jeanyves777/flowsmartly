import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const severity = searchParams.get("severity");
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (category && category !== "all") {
      where.category = category;
    }

    if (severity && severity !== "all") {
      where.severity = severity;
    }

    if (search) {
      where.OR = [
        { action: { contains: search } },
        { userId: { contains: search } },
        { ipAddress: { contains: search } },
        { path: { contains: search } },
      ];
    }

    // Fetch audit logs with pagination
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Get user info for logs
    const userIds = logs
      .map((log) => log.userId)
      .filter((id): id is string => id !== null);

    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true },
        })
      : [];

    const adminUsers = userIds.length > 0
      ? await prisma.adminUser.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true },
        })
      : [];

    const userMap = new Map([
      ...users.map((u) => [u.id, u] as const),
      ...adminUsers.map((u) => [u.id, u] as const),
    ]);

    // Format logs
    const formattedLogs = logs.map((log) => {
      const user = log.userId ? userMap.get(log.userId) : null;
      return {
        id: log.id,
        action: log.action,
        category: log.category,
        severity: log.severity,
        userId: log.userId,
        userEmail: user?.email,
        userName: user?.name,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        method: log.method,
        path: log.path,
        statusCode: log.statusCode,
        duration: log.duration,
        ipAddress: log.ipAddress,
        country: log.country,
        city: log.city,
        browser: log.browser,
        os: log.os,
        device: log.device,
        deviceType: log.deviceType,
        metadata: log.metadata ? JSON.parse(log.metadata) : {},
        oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
        newValue: log.newValue ? JSON.parse(log.newValue) : null,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt,
      };
    });

    // Get stats for filters and summary
    const [categories, severities, totalLogs, errorCount, warningCount, authCount] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ["category"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.auditLog.groupBy({
        by: ["severity"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { severity: "ERROR" } }),
      prisma.auditLog.count({ where: { severity: "WARNING" } }),
      prisma.auditLog.count({ where: { category: "AUTH" } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        logs: formattedLogs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          total: totalLogs,
          errors: errorCount,
          warnings: warningCount,
          auth: authCount,
        },
        filters: {
          categories: categories.map((c) => ({
            value: c.category,
            count: c._count.id,
          })),
          severities: severities.map((s) => ({
            value: s.severity,
            count: s._count.id,
          })),
        },
      },
    });
  } catch (error) {
    console.error("Admin audit error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch audit logs" } },
      { status: 500 }
    );
  }
}
