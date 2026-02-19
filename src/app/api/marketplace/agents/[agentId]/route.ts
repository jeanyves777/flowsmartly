import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { agentId } = await params;

    const agent = await prisma.agentProfile.findUnique({
      where: { id: agentId, status: "APPROVED" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            bio: true,
            website: true,
            createdAt: true,
          },
        },
        _count: {
          select: { clients: { where: { status: "ACTIVE" } } },
        },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: { message: "Agent not found" } },
        { status: 404 }
      );
    }

    // Check existing active/pending relationship (ignore terminated so they can re-hire)
    const existingRelationship = await prisma.agentClient.findFirst({
      where: {
        clientUserId: session.userId,
        agentProfileId: agent.id,
        status: { in: ["ACTIVE", "PAUSED", "PENDING"] },
      },
      select: { id: true, status: true, monthlyPriceCents: true, startDate: true },
    });

    // Get recent completed client count (for social proof)
    const completedClients = await prisma.agentClient.count({
      where: {
        agentProfileId: agent.id,
        status: "TERMINATED",
        terminatedBy: { not: "system" },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          displayName: agent.displayName,
          bio: agent.bio,
          coverImageUrl: agent.coverImageUrl,
          showcaseImages: JSON.parse(agent.showcaseImages),
          specialties: JSON.parse(agent.specialties),
          industries: JSON.parse(agent.industries),
          portfolioUrls: JSON.parse(agent.portfolioUrls),
          minPricePerMonth: agent.minPricePerMonth,
          performanceScore: agent.performanceScore,
          clientCount: agent._count.clients,
          completedClients,
          approvedAt: agent.approvedAt,
          user: agent.user,
        },
        relationship: existingRelationship,
        isOwnProfile: agent.userId === session.userId,
      },
    });
  } catch (error) {
    console.error("Get agent detail error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
