import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// GET /api/agent-client/[agentClientId]/approval-settings — Get approval settings
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentClientId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { agentClientId } = await params;

    // Find the agent-client relationship
    const agentClient = await prisma.agentClient.findUnique({
      where: { id: agentClientId },
      include: {
        agentProfile: true,
      },
    });

    if (!agentClient) {
      return NextResponse.json(
        { success: false, error: { message: "Agent-client relationship not found" } },
        { status: 404 }
      );
    }

    // Validate user is the client or the agent
    if (
      session.userId !== agentClient.clientUserId &&
      session.userId !== agentClient.agentProfile.userId
    ) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to view these settings" } },
        { status: 403 }
      );
    }

    // Find settings or return defaults
    const settings = await prisma.approvalSettings.findUnique({
      where: { agentClientId },
    });

    if (!settings) {
      return NextResponse.json({
        success: true,
        data: {
          settings: {
            agentClientId,
            requireApproval: "ALL",
            platformsRequiringApproval: [],
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        settings: {
          ...settings,
          platformsRequiringApproval: JSON.parse(settings.platformsRequiringApproval),
        },
      },
    });
  } catch (error) {
    console.error("Get approval settings error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}

// PUT /api/agent-client/[agentClientId]/approval-settings — Update approval settings (client only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ agentClientId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { agentClientId } = await params;

    // Find the agent-client relationship
    const agentClient = await prisma.agentClient.findUnique({
      where: { id: agentClientId },
    });

    if (!agentClient) {
      return NextResponse.json(
        { success: false, error: { message: "Agent-client relationship not found" } },
        { status: 404 }
      );
    }

    // Validate user is the client
    if (session.userId !== agentClient.clientUserId) {
      return NextResponse.json(
        { success: false, error: { message: "Only the client can update approval settings" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { requireApproval, platformsRequiringApproval } = body;

    // Validate requireApproval
    const validModes = ["ALL", "MEDIA_ONLY", "PLATFORM_SPECIFIC", "NONE"];
    if (!requireApproval || !validModes.includes(requireApproval)) {
      return NextResponse.json(
        { success: false, error: { message: `requireApproval must be one of: ${validModes.join(", ")}` } },
        { status: 400 }
      );
    }

    // Upsert the settings
    const settings = await prisma.approvalSettings.upsert({
      where: { agentClientId },
      create: {
        agentClientId,
        requireApproval,
        platformsRequiringApproval: JSON.stringify(platformsRequiringApproval || []),
      },
      update: {
        requireApproval,
        platformsRequiringApproval: JSON.stringify(platformsRequiringApproval || []),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        settings: {
          ...settings,
          platformsRequiringApproval: JSON.parse(settings.platformsRequiringApproval),
        },
      },
    });
  } catch (error) {
    console.error("Update approval settings error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
