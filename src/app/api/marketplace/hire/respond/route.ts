import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkAgentFirstHireCommission } from "@/lib/referrals";

// POST /api/marketplace/hire/respond — Agent accepts or rejects a hire request
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
    const { clientId, action, agreedToTerms } = body;

    if (!clientId || !["accept", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: { message: "clientId and action (accept/reject) are required" } },
        { status: 400 }
      );
    }

    // Verify the agent owns this profile
    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!agentProfile || agentProfile.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, error: { message: "Agent profile not found or not approved" } },
        { status: 403 }
      );
    }

    // Find the pending request
    const agentClient = await prisma.agentClient.findFirst({
      where: {
        id: clientId,
        agentProfileId: agentProfile.id,
        status: "PENDING",
      },
      include: {
        clientUser: { select: { name: true } },
      },
    });

    if (!agentClient) {
      return NextResponse.json(
        { success: false, error: { message: "Pending request not found" } },
        { status: 404 }
      );
    }

    if (action === "accept") {
      if (!agreedToTerms) {
        return NextResponse.json(
          { success: false, error: { message: "You must agree to the service terms to accept this client" } },
          { status: 400 }
        );
      }

      // Accept: set to ACTIVE, update start date
      await prisma.agentClient.update({
        where: { id: clientId },
        data: {
          status: "ACTIVE",
          agentAgreedToTerms: true,
          startDate: new Date(),
        },
      });

      // Increment agent client count
      await prisma.agentProfile.update({
        where: { id: agentProfile.id },
        data: { clientCount: { increment: 1 } },
      });

      // Check for agent-to-agent referral commission (fire-and-forget)
      checkAgentFirstHireCommission({
        agentUserId: agentProfile.userId,
        firstMonthPriceCents: agentClient.monthlyPriceCents,
      }).catch((err) => console.error("Agent referral commission error:", err));

      // Log
      await prisma.agentActivityLog.create({
        data: {
          agentClientId: clientId,
          agentProfileId: agentProfile.id,
          action: "hire_accepted",
          description: `Agent accepted hire request from ${agentClient.clientUser.name}`,
        },
      });

      return NextResponse.json({
        success: true,
        data: { status: "ACTIVE", message: "Client accepted successfully" },
      });
    } else {
      // Reject: set to TERMINATED
      await prisma.agentClient.update({
        where: { id: clientId },
        data: {
          status: "TERMINATED",
          terminatedBy: "agent",
          terminationReason: "Hire request declined",
          endDate: new Date(),
        },
      });

      // Log
      await prisma.agentActivityLog.create({
        data: {
          agentClientId: clientId,
          agentProfileId: agentProfile.id,
          action: "hire_rejected",
          description: `Agent declined hire request from ${agentClient.clientUser.name}`,
        },
      });

      return NextResponse.json({
        success: true,
        data: { status: "TERMINATED", message: "Request declined" },
      });
    }
  } catch (error) {
    console.error("Respond to hire error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
