import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Not authenticated",
          },
        },
        { status: 401 }
      );
    }

    let agentData = undefined;
    if (session.agentId) {
      const agentProfile = await prisma.agentProfile.findUnique({
        where: { id: session.agentId },
        select: { displayName: true },
      });
      agentData = {
        isImpersonating: true,
        agentInfo: {
          agentId: session.agentId,
          agentUserId: session.agentUserId,
          agentName: agentProfile?.displayName || "Agent",
        },
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        user: session.user,
        ...agentData,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred",
        },
      },
      { status: 500 }
    );
  }
}
