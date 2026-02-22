import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications";

// PUT /api/follow-ups/[id]/entries/[entryId] — Update entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id, entryId } = await params;

    // Verify ownership or assignment
    let followUp = await prisma.followUp.findFirst({
      where: { id, userId: session.userId },
      select: { id: true, userId: true },
    });

    let isOwner = !!followUp;

    // If not owner, check if user is assigned to any entry in this follow-up
    if (!followUp) {
      const hasAssignment = await prisma.followUpEntry.findFirst({
        where: { followUpId: id, assigneeId: session.userId },
        select: { id: true },
      });
      if (hasAssignment) {
        followUp = await prisma.followUp.findUnique({
          where: { id },
          select: { id: true, userId: true },
        });
      }
    }

    if (!followUp) {
      return NextResponse.json(
        { success: false, error: { message: "Follow-up not found" } },
        { status: 404 }
      );
    }

    const entry = await prisma.followUpEntry.findFirst({
      where: { id: entryId, followUpId: id },
    });

    if (!entry) {
      return NextResponse.json(
        { success: false, error: { message: "Entry not found" } },
        { status: 404 }
      );
    }

    // Non-owners can only update entries assigned to them
    if (!isOwner && entry.assigneeId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to update this entry" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { assigneeId, name, phone, email, address, referralSource, notes, status, nextFollowUp, callDate } = body;

    const data: Record<string, unknown> = {};
    // Only owners can reassign entries
    if (assigneeId !== undefined && isOwner) data.assigneeId = assigneeId || null;
    if (name !== undefined) data.name = name?.trim() || null;
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (email !== undefined) data.email = email?.trim() || null;
    if (address !== undefined) data.address = address?.trim() || null;
    if (referralSource !== undefined) data.referralSource = referralSource?.trim() || null;
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (nextFollowUp !== undefined) data.nextFollowUp = nextFollowUp ? new Date(nextFollowUp) : null;
    if (callDate !== undefined) data.callDate = callDate ? new Date(callDate) : null;

    if (status !== undefined) {
      const validStatuses = ["PENDING", "CALLED", "NO_ANSWER", "CALLBACK", "COMPLETED", "DECLINED", "NOT_INTERESTED"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: { message: "Invalid status" } },
          { status: 400 }
        );
      }
      data.status = status;

      // Auto-increment attempts when marking as CALLED or NO_ANSWER
      if (status === "CALLED" || status === "NO_ANSWER") {
        data.attempts = { increment: 1 };
        data.callDate = new Date();
      }

      // Update follow-up completedEntries counter
      const wasCompleted = entry.status === "COMPLETED";
      const isNowCompleted = status === "COMPLETED";

      if (!wasCompleted && isNowCompleted) {
        await prisma.followUp.update({
          where: { id },
          data: { completedEntries: { increment: 1 } },
        });
      } else if (wasCompleted && !isNowCompleted) {
        await prisma.followUp.update({
          where: { id },
          data: { completedEntries: { decrement: 1 } },
        });
      }
    }

    const updated = await prisma.followUpEntry.update({
      where: { id: entryId },
      data,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            imageUrl: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Notify the new assignee when assignment changes
    if (assigneeId !== undefined && assigneeId && assigneeId !== entry.assigneeId) {
      const [followUpInfo, assignerInfo] = await Promise.all([
        prisma.followUp.findUnique({ where: { id }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
      ]);
      const contactName = updated.name ||
        (updated.contact ? `${updated.contact.firstName || ""} ${updated.contact.lastName || ""}`.trim() : null) ||
        "a contact";

      createNotification({
        userId: assigneeId,
        type: "TASK_ASSIGNED",
        title: "Follow-Up Assignment",
        message: `${assignerInfo?.name || "Someone"} assigned you to ${contactName} in "${followUpInfo?.name || "a follow-up"}"`,
        actionUrl: `/tools/follow-ups/${id}`,
      }).catch((err) => console.error("Assignment notification error:", err));
    }

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        customData: JSON.parse(updated.customData || "{}"),
      },
    });
  } catch (error) {
    console.error("Update entry error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update entry" } },
      { status: 500 }
    );
  }
}

// DELETE /api/follow-ups/[id]/entries/[entryId] — Delete entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id, entryId } = await params;

    const followUp = await prisma.followUp.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!followUp) {
      return NextResponse.json(
        { success: false, error: { message: "Follow-up not found" } },
        { status: 404 }
      );
    }

    const entry = await prisma.followUpEntry.findFirst({
      where: { id: entryId, followUpId: id },
    });

    if (!entry) {
      return NextResponse.json(
        { success: false, error: { message: "Entry not found" } },
        { status: 404 }
      );
    }

    await prisma.followUpEntry.delete({ where: { id: entryId } });

    // Update counters
    const updates: Record<string, unknown> = { totalEntries: { decrement: 1 } };
    if (entry.status === "COMPLETED") {
      updates.completedEntries = { decrement: 1 };
    }
    await prisma.followUp.update({ where: { id }, data: updates });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete entry error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete entry" } },
      { status: 500 }
    );
  }
}
