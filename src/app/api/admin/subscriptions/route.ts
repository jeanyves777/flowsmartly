import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/admin/subscriptions
 * Admin endpoint for subscription management.
 * Supports views: stats, users
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const view = request.nextUrl.searchParams.get("view") || "stats";

  try {
    if (view === "stats") {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [totalUsers, starterUsers, paidUsers, expiringIn7Days, expiredNotReset] = await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { plan: "STARTER", deletedAt: null } }),
        prisma.user.count({ where: { plan: { not: "STARTER" }, deletedAt: null } }),
        prisma.user.count({
          where: {
            plan: { not: "STARTER" },
            planExpiresAt: { gte: now, lte: sevenDaysFromNow },
            deletedAt: null,
          },
        }),
        prisma.user.count({
          where: {
            plan: { not: "STARTER" },
            planExpiresAt: { lt: now },
            deletedAt: null,
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: { totalUsers, starterUsers, paidUsers, expiringIn7Days, expiredNotReset },
      });
    }

    if (view === "users") {
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
      const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);
      const search = request.nextUrl.searchParams.get("search") || "";
      const planFilter = request.nextUrl.searchParams.get("plan") || "";

      const where: Record<string, unknown> = { deletedAt: null };

      if (search) {
        where.OR = [
          { email: { contains: search } },
          { name: { contains: search } },
        ];
      }

      if (planFilter && planFilter !== "all") {
        where.plan = planFilter;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            plan: true,
            aiCredits: true,
            planExpiresAt: true,
            stripeCustomerId: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: { users, total },
      });
    }

    return NextResponse.json({ error: "Invalid view" }, { status: 400 });
  } catch (err) {
    console.error("[Admin Subscriptions] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
