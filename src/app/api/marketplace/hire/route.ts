import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { agentId, message } = body;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: { message: "Agent ID is required" } },
        { status: 400 }
      );
    }

    // Verify agent exists and is approved
    const agent = await prisma.agentProfile.findUnique({
      where: { id: agentId, status: "APPROVED" },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: { message: "Agent not found" } },
        { status: 404 }
      );
    }

    // Cannot hire yourself
    if (agent.userId === session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "You cannot hire yourself" } },
        { status: 400 }
      );
    }

    // Check if already has an active/paused relationship
    const existing = await prisma.agentClient.findFirst({
      where: {
        clientUserId: session.userId,
        agentProfileId: agentId,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { message: "You already have an active relationship with this agent" } },
        { status: 400 }
      );
    }

    // Create the agent-client relationship
    const agentClient = await prisma.agentClient.create({
      data: {
        agentProfileId: agentId,
        clientUserId: session.userId,
        monthlyPriceCents: agent.minPricePerMonth,
        status: "ACTIVE",
      },
    });

    // Update agent's client count
    await prisma.agentProfile.update({
      where: { id: agentId },
      data: { clientCount: { increment: 1 } },
    });

    // Log the activity
    await prisma.agentActivityLog.create({
      data: {
        agentClientId: agentClient.id,
        agentProfileId: agentId,
        action: "client_hired",
        description: `New client hired agent${message ? `: ${message}` : ""}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: { client: agentClient },
    });
  } catch (error) {
    console.error("Hire agent error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
