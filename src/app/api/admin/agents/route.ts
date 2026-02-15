import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/agents - List all agent profiles
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
    const status = searchParams.get("status") || "all";

    const where: Record<string, unknown> = {};
    if (status !== "all") {
      where.status = status.toUpperCase();
    }

    const profiles = await prisma.agentProfile.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, plan: true },
        },
        _count: { select: { clients: true, warnings: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: { profiles } });
  } catch (error) {
    console.error("Admin get agents error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/agents - Approve or reject an agent profile
export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { profileId, action, reason } = body as {
      profileId: string;
      action: "approve" | "reject" | "suspend";
      reason?: string;
    };

    if (!profileId || !action) {
      return NextResponse.json(
        { success: false, error: { message: "profileId and action are required" } },
        { status: 400 }
      );
    }

    const profile = await prisma.agentProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "Agent profile not found" } },
        { status: 404 }
      );
    }

    if (action === "approve") {
      // Approve the agent profile
      await prisma.agentProfile.update({
        where: { id: profileId },
        data: { status: "APPROVED", approvedAt: new Date(), rejectedReason: null },
      });

      // Upgrade user's plan to AGENT (free, full access)
      await prisma.user.update({
        where: { id: profile.userId },
        data: { plan: "AGENT" },
      });
    } else if (action === "reject") {
      await prisma.agentProfile.update({
        where: { id: profileId },
        data: { status: "REJECTED", rejectedReason: reason || null },
      });
    } else if (action === "suspend") {
      await prisma.agentProfile.update({
        where: { id: profileId },
        data: { status: "SUSPENDED" },
      });

      // End all active impersonation sessions
      await prisma.agentSession.updateMany({
        where: { agentProfileId: profileId, endedAt: null },
        data: { endedAt: new Date() },
      });
    }

    const updated = await prisma.agentProfile.findUnique({
      where: { id: profileId },
      include: {
        user: {
          select: { id: true, name: true, email: true, plan: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: { profile: updated } });
  } catch (error) {
    console.error("Admin update agent error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
