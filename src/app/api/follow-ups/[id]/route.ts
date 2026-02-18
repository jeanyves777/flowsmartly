import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/follow-ups/[id] — Get single follow-up with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const followUp = await prisma.followUp.findFirst({
      where: { id, userId: session.userId },
      include: {
        contactList: { select: { id: true, name: true } },
        survey: {
          select: {
            id: true,
            title: true,
            slug: true,
            isActive: true,
            responseCount: true,
            questions: true,
          },
        },
        _count: { select: { entries: true } },
      },
    });

    if (!followUp) {
      return NextResponse.json(
        { success: false, error: { message: "Follow-up not found" } },
        { status: 404 }
      );
    }

    // Get entry counts by status
    const statusCounts = await prisma.followUpEntry.groupBy({
      by: ["status"],
      where: { followUpId: id },
      _count: true,
    });

    const statusBreakdown: Record<string, number> = {};
    statusCounts.forEach((s) => {
      statusBreakdown[s.status] = s._count;
    });

    return NextResponse.json({
      success: true,
      data: {
        ...followUp,
        settings: JSON.parse(followUp.settings || "{}"),
        survey: followUp.survey
          ? {
              ...followUp.survey,
              questions: JSON.parse(followUp.survey.questions || "[]"),
            }
          : null,
        contactListName: followUp.contactList?.name || null,
        statusBreakdown,
      },
    });
  } catch (error) {
    console.error("Get follow-up error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch follow-up" } },
      { status: 500 }
    );
  }
}

// PUT /api/follow-ups/[id] — Update follow-up
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const existing = await prisma.followUp.findFirst({
      where: { id, userId: session.userId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Follow-up not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, status, settings } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (status !== undefined) {
      if (!["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"].includes(status)) {
        return NextResponse.json(
          { success: false, error: { message: "Invalid status" } },
          { status: 400 }
        );
      }
      data.status = status;
    }
    if (settings !== undefined) data.settings = JSON.stringify(settings);

    const updated = await prisma.followUp.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update follow-up error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update follow-up" } },
      { status: 500 }
    );
  }
}

// DELETE /api/follow-ups/[id] — Delete follow-up (cascades entries, survey, responses)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const existing = await prisma.followUp.findFirst({
      where: { id, userId: session.userId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Follow-up not found" } },
        { status: 404 }
      );
    }

    await prisma.followUp.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete follow-up error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete follow-up" } },
      { status: 500 }
    );
  }
}
