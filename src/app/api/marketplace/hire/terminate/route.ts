import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// POST /api/marketplace/hire/terminate — Client unhires an agent (with reason + release agreement)
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
    const { clientId, reason, agreedToRelease } = body;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: { message: "Client relationship ID is required" } },
        { status: 400 }
      );
    }

    if (!agreedToRelease) {
      return NextResponse.json(
        { success: false, error: { message: "You must agree to the termination release to proceed" } },
        { status: 400 }
      );
    }

    // Find the active/paused relationship for this user
    const agentClient = await prisma.agentClient.findFirst({
      where: {
        id: clientId,
        clientUserId: session.userId,
        status: { in: ["ACTIVE", "PAUSED", "PENDING"] },
      },
      include: {
        agentProfile: { select: { id: true, displayName: true, clientCount: true } },
      },
    });

    if (!agentClient) {
      return NextResponse.json(
        { success: false, error: { message: "Active relationship not found" } },
        { status: 404 }
      );
    }

    const wasPending = agentClient.status === "PENDING";

    // Terminate the relationship
    await prisma.agentClient.update({
      where: { id: clientId },
      data: {
        status: "TERMINATED",
        terminatedBy: "client",
        terminationReason: reason?.trim() || "Client ended the relationship",
        endDate: new Date(),
      },
    });

    // Decrement agent client count only if it was ACTIVE
    if (!wasPending && agentClient.agentProfile.clientCount > 0) {
      await prisma.agentProfile.update({
        where: { id: agentClient.agentProfileId },
        data: { clientCount: { decrement: 1 } },
      });
    }

    // Log
    await prisma.agentActivityLog.create({
      data: {
        agentClientId: clientId,
        agentProfileId: agentClient.agentProfileId,
        action: wasPending ? "hire_cancelled" : "client_unhired",
        description: wasPending
          ? `Client cancelled hire request${reason ? `: ${reason}` : ""}`
          : `Client terminated the relationship${reason ? `: ${reason}` : ""}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: wasPending ? "Hire request cancelled" : "Agent relationship terminated successfully" },
    });
  } catch (error) {
    console.error("Terminate agent error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
