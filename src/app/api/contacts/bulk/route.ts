import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// POST /api/contacts/bulk - Bulk operations on contacts
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
    const { action, contactIds, listId, status } = body;

    if (!action || !contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "Action and contactIds are required" } },
        { status: 400 }
      );
    }

    let affected = 0;

    switch (action) {
      case "delete": {
        // Find list memberships for these contacts (scoped to user)
        const memberships = await prisma.contactListMember.findMany({
          where: {
            contact: { userId: session.userId },
            contactId: { in: contactIds },
          },
          select: { contactListId: true },
        });
        const affectedListIds = [...new Set(memberships.map(m => m.contactListId))];

        // Delete contacts scoped to user
        const result = await prisma.contact.deleteMany({
          where: {
            id: { in: contactIds },
            userId: session.userId,
          },
        });
        affected = result.count;

        // Recount affected lists
        await Promise.all(affectedListIds.map(id => recountList(id)));
        break;
      }

      case "addToList": {
        if (!listId) {
          return NextResponse.json(
            { success: false, error: { message: "listId is required for addToList action" } },
            { status: 400 }
          );
        }

        // Validate list belongs to user
        const list = await prisma.contactList.findFirst({
          where: { id: listId, userId: session.userId },
        });
        if (!list) {
          return NextResponse.json(
            { success: false, error: { message: "List not found" } },
            { status: 404 }
          );
        }

        // Verify contacts belong to user
        const userContacts = await prisma.contact.findMany({
          where: { id: { in: contactIds }, userId: session.userId },
          select: { id: true },
        });
        const validContactIds = userContacts.map(c => c.id);

        // Filter out existing memberships
        const existingMembers = await prisma.contactListMember.findMany({
          where: { contactListId: listId, contactId: { in: validContactIds } },
          select: { contactId: true },
        });
        const existingSet = new Set(existingMembers.map(m => m.contactId));
        const newContactIds = validContactIds.filter(id => !existingSet.has(id));

        if (newContactIds.length > 0) {
          await prisma.contactListMember.createMany({
            data: newContactIds.map(cId => ({
              contactId: cId,
              contactListId: listId,
            })),
          });
        }
        affected = newContactIds.length;

        // Recount list
        await recountList(listId);
        break;
      }

      case "removeFromList": {
        if (!listId) {
          return NextResponse.json(
            { success: false, error: { message: "listId is required for removeFromList action" } },
            { status: 400 }
          );
        }

        // Delete memberships scoped to user's contacts
        const removeResult = await prisma.contactListMember.deleteMany({
          where: {
            contactListId: listId,
            contactId: { in: contactIds },
            contact: { userId: session.userId },
          },
        });
        affected = removeResult.count;

        // Recount list
        await recountList(listId);
        break;
      }

      case "updateStatus": {
        if (!status) {
          return NextResponse.json(
            { success: false, error: { message: "status is required for updateStatus action" } },
            { status: 400 }
          );
        }

        const upperStatus = status.toUpperCase();
        const updateData: Record<string, unknown> = { status: upperStatus };

        if (upperStatus === "UNSUBSCRIBED") {
          updateData.unsubscribedAt = new Date();
        } else if (upperStatus === "ACTIVE") {
          updateData.unsubscribedAt = null;
        }

        const updateResult = await prisma.contact.updateMany({
          where: {
            id: { in: contactIds },
            userId: session.userId,
          },
          data: updateData,
        });
        affected = updateResult.count;
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: { message: `Unknown action: ${action}` } },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: { affected },
    });
  } catch (error) {
    console.error("Bulk contacts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to perform bulk operation" } },
      { status: 500 }
    );
  }
}

async function recountList(listId: string) {
  const [total, active] = await Promise.all([
    prisma.contactListMember.count({ where: { contactListId: listId } }),
    prisma.contactListMember.count({
      where: { contactListId: listId, contact: { status: "ACTIVE" } },
    }),
  ]);
  await prisma.contactList.update({
    where: { id: listId },
    data: { totalCount: total, activeCount: active },
  });
}
