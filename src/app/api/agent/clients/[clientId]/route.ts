import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { clientId } = await params;

    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!agentProfile) {
      return NextResponse.json(
        { success: false, error: { message: "Agent profile not found" } },
        { status: 403 }
      );
    }

    const agentClient = await prisma.agentClient.findUnique({
      where: { id: clientId },
      include: {
        clientUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            plan: true,
            createdAt: true,
            bio: true,
            website: true,
          },
        },
        warnings: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!agentClient || agentClient.agentProfileId !== agentProfile.id) {
      return NextResponse.json(
        { success: false, error: { message: "Client not found" } },
        { status: 404 }
      );
    }

    // Get strategy data
    const strategies = await prisma.marketingStrategy.findMany({
      where: { userId: agentClient.clientUserId, status: "ACTIVE" },
      include: {
        tasks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    // Get performance scores
    const scores = await prisma.strategyScore.findMany({
      where: { userId: agentClient.clientUserId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 6,
    });

    // Get recent posts
    const recentPosts = await prisma.post.findMany({
      where: { userId: agentClient.clientUserId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        caption: true,
        createdAt: true,
        likeCount: true,
        viewCount: true,
      },
    });

    // Get recent campaigns
    const recentCampaigns = await prisma.campaign.findMany({
      where: { userId: agentClient.clientUserId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
        createdAt: true,
        sentAt: true,
        sentCount: true,
      },
    });

    // Calculate task stats
    const allTasks = strategies.flatMap((s) => s.tasks);
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === "DONE").length;
    const overdueTasks = allTasks.filter(
      (t) => t.status !== "DONE" && t.dueDate && new Date(t.dueDate) < new Date()
    ).length;
    const inProgressTasks = allTasks.filter((t) => t.status === "IN_PROGRESS").length;

    return NextResponse.json({
      success: true,
      data: {
        client: agentClient,
        strategies,
        scores,
        recentPosts,
        recentCampaigns,
        taskStats: {
          total: totalTasks,
          completed: completedTasks,
          overdue: overdueTasks,
          inProgress: inProgressTasks,
        },
      },
    });
  } catch (error) {
    console.error("Get agent client detail error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { clientId } = await params;

    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!agentProfile) {
      return NextResponse.json(
        { success: false, error: { message: "Agent profile not found" } },
        { status: 403 }
      );
    }

    const agentClient = await prisma.agentClient.findUnique({
      where: { id: clientId },
    });
    if (!agentClient || agentClient.agentProfileId !== agentProfile.id) {
      return NextResponse.json(
        { success: false, error: { message: "Client not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === "TERMINATED") {
        updates.endDate = new Date();
        updates.terminatedBy = "agent";
        updates.terminationReason = body.reason || "Terminated by agent";
      }
    }

    const updated = await prisma.agentClient.update({
      where: { id: clientId },
      data: updates,
    });

    return NextResponse.json({ success: true, data: { client: updated } });
  } catch (error) {
    console.error("Update agent client error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
