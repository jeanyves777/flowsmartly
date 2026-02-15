import { NextResponse } from "next/server";
import { getSession, startAgentSession, endAgentSession } from "@/lib/auth/session";
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
    const { clientId, reason } = body;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: { message: "Client ID is required" } },
        { status: 400 }
      );
    }

    // Get agent profile
    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!agentProfile || agentProfile.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, error: { message: "Agent profile not found or not approved" } },
        { status: 403 }
      );
    }

    // Verify agent-client relationship
    const agentClient = await prisma.agentClient.findUnique({
      where: { id: clientId },
    });
    if (!agentClient || agentClient.agentProfileId !== agentProfile.id) {
      return NextResponse.json(
        { success: false, error: { message: "Client relationship not found" } },
        { status: 404 }
      );
    }
    if (agentClient.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: { message: "Client relationship is not active" } },
        { status: 400 }
      );
    }

    // End any existing agent sessions
    await prisma.agentSession.updateMany({
      where: { agentProfileId: agentProfile.id, endedAt: null },
      data: { endedAt: new Date() },
    });

    // Start new impersonation session
    await startAgentSession(agentProfile.id, agentClient.clientUserId, reason);

    // Log the impersonation
    await prisma.agentActivityLog.create({
      data: {
        agentClientId: agentClient.id,
        agentProfileId: agentProfile.id,
        action: "impersonation_started",
        description: `Agent started managing client account${reason ? `: ${reason}` : ""}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: { redirectUrl: "/dashboard" },
    });
  } catch (error) {
    console.error("Start impersonation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await endAgentSession();

    return NextResponse.json({
      success: true,
      data: { redirectUrl: "/agent/clients" },
    });
  } catch (error) {
    console.error("End impersonation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
