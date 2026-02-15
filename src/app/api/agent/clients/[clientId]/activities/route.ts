import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

interface Activity {
  id: string;
  type: "post" | "campaign" | "task" | "automation";
  title: string;
  description?: string;
  status: "on_time" | "late" | "needs_attention";
  date: Date;
  metadata?: Record<string, unknown>;
}

export async function GET(
  request: NextRequest,
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
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get("status");
    const typeFilter = searchParams.get("type");

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

    const clientUserId = agentClient.clientUserId;
    const activities: Activity[] = [];

    // Get posts
    if (!typeFilter || typeFilter === "post") {
      const posts = await prisma.post.findMany({
        where: { userId: clientUserId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          caption: true,
          createdAt: true,
          scheduledAt: true,
          publishedAt: true,
          likeCount: true,
          viewCount: true,
        },
      });

      posts.forEach((post) => {
        const wasScheduled = post.scheduledAt;
        const wasOnTime = !wasScheduled || (post.publishedAt && post.publishedAt <= new Date(new Date(post.scheduledAt!).getTime() + 60 * 60 * 1000));

        activities.push({
          id: post.id,
          type: "post",
          title: post.caption?.substring(0, 80) || "Post",
          status: wasOnTime ? "on_time" : "late",
          date: post.createdAt,
          metadata: { likes: post.likeCount, views: post.viewCount },
        });
      });
    }

    // Get campaigns
    if (!typeFilter || typeFilter === "campaign") {
      const campaigns = await prisma.campaign.findMany({
        where: { userId: clientUserId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          name: true,
          status: true,
          scheduledAt: true,
          sentAt: true,
          createdAt: true,
          sentCount: true,
        },
      });

      campaigns.forEach((campaign) => {
        const isLate = campaign.scheduledAt && !campaign.sentAt && new Date(campaign.scheduledAt) < new Date();
        const needsAttention = campaign.status === "DRAFT" || campaign.status === "FAILED";

        activities.push({
          id: campaign.id,
          type: "campaign",
          title: campaign.name,
          status: isLate ? "late" : needsAttention ? "needs_attention" : "on_time",
          date: campaign.sentAt || campaign.createdAt,
          metadata: { totalSent: campaign.sentCount, campaignStatus: campaign.status },
        });
      });
    }

    // Get strategy tasks
    if (!typeFilter || typeFilter === "task") {
      const tasks = await prisma.strategyTask.findMany({
        where: { strategy: { userId: clientUserId } },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          category: true,
          dueDate: true,
          completedAt: true,
          updatedAt: true,
          progress: true,
        },
      });

      tasks.forEach((task) => {
        const isOverdue = task.status !== "DONE" && task.dueDate && new Date(task.dueDate) < new Date();
        const isCompletedLate = task.status === "DONE" && task.dueDate && task.completedAt && task.completedAt > task.dueDate;

        activities.push({
          id: task.id,
          type: "task",
          title: task.title,
          description: `${task.category || "general"} | ${task.priority} priority`,
          status: isOverdue ? "late" : isCompletedLate ? "needs_attention" : "on_time",
          date: task.completedAt || task.updatedAt,
          metadata: { taskStatus: task.status, progress: task.progress, category: task.category },
        });
      });
    }

    // Sort by date descending
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply status filter
    let filtered = activities;
    if (statusFilter && statusFilter !== "all") {
      filtered = activities.filter((a) => a.status === statusFilter);
    }

    // Summary counts
    const onTimeCount = activities.filter((a) => a.status === "on_time").length;
    const lateCount = activities.filter((a) => a.status === "late").length;
    const needsAttentionCount = activities.filter((a) => a.status === "needs_attention").length;

    return NextResponse.json({
      success: true,
      data: {
        activities: filtered,
        summary: {
          total: activities.length,
          onTime: onTimeCount,
          late: lateCount,
          needsAttention: needsAttentionCount,
        },
      },
    });
  } catch (error) {
    console.error("Get client activities error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
