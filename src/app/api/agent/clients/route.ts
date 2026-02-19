import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!agentProfile || agentProfile.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, error: { message: "Agent profile not found or not approved" } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "startDate";

    // Build where clause
    const where: Record<string, unknown> = { agentProfileId: agentProfile.id };
    if (status && status !== "ALL") {
      where.status = status;
    }

    // Count pending requests separately
    const pendingCount = await prisma.agentClient.count({
      where: { agentProfileId: agentProfile.id, status: "PENDING" },
    });

    // Get clients with user info
    const clients = await prisma.agentClient.findMany({
      where,
      include: {
        clientUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            plan: true,
            createdAt: true,
          },
        },
      },
      orderBy: sort === "name"
        ? { clientUser: { name: "asc" } }
        : sort === "price"
        ? { monthlyPriceCents: "desc" }
        : { startDate: "desc" },
    });

    // Filter by search if provided
    let filteredClients = clients;
    if (search) {
      const q = search.toLowerCase();
      filteredClients = clients.filter(
        (c) =>
          c.clientUser.name.toLowerCase().includes(q) ||
          c.clientUser.email.toLowerCase().includes(q)
      );
    }

    // Get activity stats for each client
    const clientsWithStats = await Promise.all(
      filteredClients.map(async (client) => {
        // Get strategy tasks stats
        const tasks = await prisma.strategyTask.findMany({
          where: {
            strategy: { userId: client.clientUserId },
          },
          select: { status: true, dueDate: true, completedAt: true },
        });

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t) => t.status === "DONE").length;
        const overdueTasks = tasks.filter(
          (t) => t.status !== "DONE" && t.dueDate && new Date(t.dueDate) < new Date()
        ).length;

        // Get latest strategy score
        const latestScore = await prisma.strategyScore.findFirst({
          where: { userId: client.clientUserId },
          orderBy: [{ year: "desc" }, { month: "desc" }],
          select: { overallScore: true },
        });

        // Determine activity status
        let activityStatus: "on_time" | "late" | "needs_attention" = "on_time";
        if (overdueTasks > 2) activityStatus = "late";
        else if (overdueTasks > 0) activityStatus = "needs_attention";

        // Get latest activity
        const latestPost = await prisma.post.findFirst({
          where: { userId: client.clientUserId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });

        return {
          ...client,
          stats: {
            totalTasks,
            completedTasks,
            overdueTasks,
            performanceScore: latestScore?.overallScore || 0,
            activityStatus,
            lastActivity: latestPost?.createdAt || client.startDate,
          },
        };
      })
    );

    // Summary stats
    const totalClients = clients.length;
    const activeClients = clients.filter((c) => c.status === "ACTIVE").length;
    const needsAttention = clientsWithStats.filter(
      (c) => c.stats.activityStatus === "needs_attention" || c.stats.activityStatus === "late"
    ).length;
    const monthlyRevenue = clients
      .filter((c) => c.status === "ACTIVE")
      .reduce((sum, c) => sum + c.monthlyPriceCents, 0);

    // Get pending requests with client info
    const pendingRequests = await prisma.agentClient.findMany({
      where: { agentProfileId: agentProfile.id, status: "PENDING" },
      include: {
        clientUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            plan: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        clients: clientsWithStats,
        pendingRequests: pendingRequests.map((r) => ({
          id: r.id,
          clientUser: r.clientUser,
          monthlyPriceCents: r.monthlyPriceCents,
          message: r.message,
          createdAt: r.createdAt,
        })),
        summary: {
          totalClients,
          activeClients,
          pendingCount,
          needsAttention,
          monthlyRevenue,
        },
      },
    });
  } catch (error) {
    console.error("Get agent clients error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
