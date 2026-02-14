import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

/** Format a PostAutomation record for the API response */
function formatAutomation(a: {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  schedule: string;
  topic: string | null;
  aiPrompt: string | null;
  aiTone: string;
  platforms: string;
  includeMedia: boolean;
  mediaType: string | null;
  mediaStyle: string | null;
  startDate: Date;
  endDate: Date | null;
  totalGenerated: number;
  totalCreditsSpent: number;
  lastTriggered: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    enabled: a.enabled,
    schedule: (() => {
      try {
        return JSON.parse(a.schedule);
      } catch {
        return {};
      }
    })(),
    topic: a.topic,
    aiPrompt: a.aiPrompt,
    aiTone: a.aiTone,
    platforms: (() => {
      try {
        return JSON.parse(a.platforms);
      } catch {
        return [];
      }
    })(),
    includeMedia: a.includeMedia,
    mediaType: a.mediaType,
    mediaStyle: a.mediaStyle,
    startDate: a.startDate.toISOString(),
    endDate: a.endDate?.toISOString() || null,
    totalGenerated: a.totalGenerated,
    totalCreditsSpent: a.totalCreditsSpent,
    lastTriggered: a.lastTriggered?.toISOString() || null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

// GET /api/content/automation - List user's PostAutomation records
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const automations = await prisma.postAutomation.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: { automations: automations.map(formatAutomation) },
    });
  } catch (error) {
    console.error("Get post automations error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch post automations" } },
      { status: 500 }
    );
  }
}

// POST /api/content/automation - Create PostAutomation
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name, type, schedule, topic, aiPrompt, aiTone, platforms,
      includeMedia, mediaType, mediaStyle, startDate, endDate,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Name is required" } },
        { status: 400 }
      );
    }

    const validTypes = ["RECURRING", "EVENT_BASED", "AI_GENERATED"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: { message: `Type must be one of: ${validTypes.join(", ")}` } },
        { status: 400 }
      );
    }

    // End date required for RECURRING and AI_GENERATED
    if ((type === "RECURRING" || type === "AI_GENERATED") && !endDate) {
      return NextResponse.json(
        { success: false, error: { message: "End date is required for recurring automations" } },
        { status: 400 }
      );
    }

    // Validate end date is after start date
    const parsedStart = startDate ? new Date(startDate) : new Date();
    const parsedEnd = endDate ? new Date(endDate) : null;
    if (parsedEnd && parsedEnd <= parsedStart) {
      return NextResponse.json(
        { success: false, error: { message: "End date must be after start date" } },
        { status: 400 }
      );
    }

    // Validate media options
    if (includeMedia && !["image", "video"].includes(mediaType)) {
      return NextResponse.json(
        { success: false, error: { message: "Media type must be 'image' or 'video'" } },
        { status: 400 }
      );
    }

    const scheduleString =
      schedule && typeof schedule === "object"
        ? JSON.stringify(schedule)
        : schedule || "{}";

    const platformsString = Array.isArray(platforms)
      ? JSON.stringify(platforms)
      : "[]";

    const automation = await prisma.postAutomation.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        type,
        schedule: scheduleString,
        topic: topic || null,
        aiPrompt: aiPrompt || null,
        aiTone: aiTone || "professional",
        platforms: platformsString,
        includeMedia: !!includeMedia,
        mediaType: includeMedia ? mediaType : null,
        mediaStyle: includeMedia ? (mediaStyle || null) : null,
        startDate: parsedStart,
        endDate: parsedEnd,
      },
    });

    return NextResponse.json({
      success: true,
      data: { automation: formatAutomation(automation) },
    });
  } catch (error) {
    console.error("Create post automation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create post automation" } },
      { status: 500 }
    );
  }
}

// PATCH /api/content/automation - Update PostAutomation
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      id, name, type, schedule, topic, aiPrompt, aiTone, platforms, enabled,
      includeMedia, mediaType, mediaStyle, startDate, endDate,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Automation id is required" } },
        { status: 400 }
      );
    }

    const existing = await prisma.postAutomation.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Automation not found" } },
        { status: 404 }
      );
    }

    if (existing.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to update this automation" } },
        { status: 403 }
      );
    }

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name.trim();
    if (type !== undefined) {
      const validTypes = ["RECURRING", "EVENT_BASED", "AI_GENERATED"];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { success: false, error: { message: `Type must be one of: ${validTypes.join(", ")}` } },
          { status: 400 }
        );
      }
      updateData.type = type;
    }
    if (schedule !== undefined) {
      updateData.schedule =
        typeof schedule === "object" ? JSON.stringify(schedule) : schedule;
    }
    if (topic !== undefined) updateData.topic = topic || null;
    if (aiPrompt !== undefined) updateData.aiPrompt = aiPrompt || null;
    if (aiTone !== undefined) updateData.aiTone = aiTone;
    if (platforms !== undefined) {
      updateData.platforms = Array.isArray(platforms)
        ? JSON.stringify(platforms)
        : platforms;
    }
    if (enabled !== undefined) updateData.enabled = !!enabled;
    if (includeMedia !== undefined) updateData.includeMedia = !!includeMedia;
    if (mediaType !== undefined) updateData.mediaType = mediaType || null;
    if (mediaStyle !== undefined) updateData.mediaStyle = mediaStyle || null;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    const automation = await prisma.postAutomation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { automation: formatAutomation(automation) },
    });
  } catch (error) {
    console.error("Update post automation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update post automation" } },
      { status: 500 }
    );
  }
}

// DELETE /api/content/automation - Delete PostAutomation
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "id search parameter is required" } },
        { status: 400 }
      );
    }

    const existing = await prisma.postAutomation.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Automation not found" } },
        { status: 404 }
      );
    }

    if (existing.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to delete this automation" } },
        { status: 403 }
      );
    }

    await prisma.postAutomation.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      data: { deleted: true, id },
    });
  } catch (error) {
    console.error("Delete post automation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete post automation" } },
      { status: 500 }
    );
  }
}
