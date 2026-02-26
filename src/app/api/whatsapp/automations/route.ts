import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * WhatsApp Automations API
 * Manage automation rules (auto-replies, workflows)
 */

// GET: List all automations
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isActive = request.nextUrl.searchParams.get("isActive");

    const where: any = {
      userId: session.userId,
    };

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    const automations = await prisma.whatsAppAutomation.findMany({
      where,
      include: {
        socialAccount: {
          select: {
            id: true,
            platformUsername: true,
            platformDisplayName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      automations,
    });
  } catch (error) {
    console.error("Get automations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch automations" },
      { status: 500 }
    );
  }
}

// POST: Create new automation
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      triggerType,
      triggerConfig,
      actionType,
      actionValue,
      actionConfig,
      socialAccountId,
      isActive = true,
    } = body;

    // Validate required fields
    if (!name || !triggerType || !actionType || !socialAccountId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify social account belongs to user
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        id: socialAccountId,
        userId: session.userId,
        platform: "whatsapp",
      },
    });

    if (!socialAccount) {
      return NextResponse.json(
        { error: "WhatsApp account not found" },
        { status: 404 }
      );
    }

    // Create automation
    const automation = await prisma.whatsAppAutomation.create({
      data: {
        userId: session.userId,
        socialAccountId,
        name,
        triggerType,
        triggerConfig: triggerConfig ? JSON.stringify(triggerConfig) : null,
        actionType,
        actionValue: actionValue || null,
        actionConfig: actionConfig ? JSON.stringify(actionConfig) : null,
        isActive,
      },
    });

    return NextResponse.json({
      success: true,
      automation,
    });
  } catch (error) {
    console.error("Create automation error:", error);
    return NextResponse.json(
      { error: "Failed to create automation" },
      { status: 500 }
    );
  }
}

// PATCH: Update automation
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      automationId,
      name,
      triggerType,
      triggerConfig,
      actionType,
      actionValue,
      actionConfig,
      isActive,
    } = body;

    if (!automationId) {
      return NextResponse.json(
        { error: "automationId is required" },
        { status: 400 }
      );
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (triggerType !== undefined) updateData.triggerType = triggerType;
    if (triggerConfig !== undefined)
      updateData.triggerConfig = JSON.stringify(triggerConfig);
    if (actionType !== undefined) updateData.actionType = actionType;
    if (actionValue !== undefined) updateData.actionValue = actionValue;
    if (actionConfig !== undefined)
      updateData.actionConfig = JSON.stringify(actionConfig);
    if (isActive !== undefined) updateData.isActive = isActive;

    const automation = await prisma.whatsAppAutomation.updateMany({
      where: {
        id: automationId,
        userId: session.userId,
      },
      data: updateData,
    });

    if (automation.count === 0) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Automation updated",
    });
  } catch (error) {
    console.error("Update automation error:", error);
    return NextResponse.json(
      { error: "Failed to update automation" },
      { status: 500 }
    );
  }
}

// DELETE: Delete automation
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const automationId = request.nextUrl.searchParams.get("automationId");

    if (!automationId) {
      return NextResponse.json(
        { error: "automationId is required" },
        { status: 400 }
      );
    }

    const result = await prisma.whatsAppAutomation.deleteMany({
      where: {
        id: automationId,
        userId: session.userId,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Automation deleted",
    });
  } catch (error) {
    console.error("Delete automation error:", error);
    return NextResponse.json(
      { error: "Failed to delete automation" },
      { status: 500 }
    );
  }
}
