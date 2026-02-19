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
    const { agentId, message, agreedToTerms } = body;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: { message: "Agent ID is required" } },
        { status: 400 }
      );
    }

    if (!agreedToTerms) {
      return NextResponse.json(
        { success: false, error: { message: "You must agree to the service terms" } },
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

    // Check if already has an active/paused/pending relationship
    const existing = await prisma.agentClient.findFirst({
      where: {
        clientUserId: session.userId,
        agentProfileId: agentId,
        status: { in: ["ACTIVE", "PAUSED", "PENDING"] },
      },
    });

    if (existing) {
      const msg = existing.status === "PENDING"
        ? "You already have a pending request with this agent"
        : "You already have an active relationship with this agent";
      return NextResponse.json(
        { success: false, error: { message: msg } },
        { status: 400 }
      );
    }

    // Delete any old terminated record (unique constraint: one record per agent-client pair)
    await prisma.agentClient.deleteMany({
      where: {
        clientUserId: session.userId,
        agentProfileId: agentId,
        status: "TERMINATED",
      },
    });

    // Create the agent-client relationship as PENDING (agent must accept)
    const agentClient = await prisma.agentClient.create({
      data: {
        agentProfileId: agentId,
        clientUserId: session.userId,
        monthlyPriceCents: agent.minPricePerMonth,
        status: "PENDING",
        message: message?.trim() || null,
        agreedToTerms: true,
      },
    });

    // Log the activity
    await prisma.agentActivityLog.create({
      data: {
        agentClientId: agentClient.id,
        agentProfileId: agentId,
        action: "hire_requested",
        description: `Client sent a hire request${message ? `: ${message}` : ""}`,
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
