import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

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

// POST /api/contact-lists/[listId]/contacts - Add contacts to list
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const list = await prisma.contactList.findFirst({
      where: { id: listId, userId: session.userId },
    });

    if (!list) {
      return NextResponse.json(
        { success: false, error: { message: "Contact list not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { contactIds } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "contactIds must be a non-empty array" } },
        { status: 400 }
      );
    }

    // Validate all contactIds belong to the user
    const validContacts = await prisma.contact.findMany({
      where: { id: { in: contactIds }, userId: session.userId },
      select: { id: true },
    });

    const validIds = validContacts.map((c) => c.id);

    if (validIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "No valid contacts found" } },
        { status: 400 }
      );
    }

    // Filter out contacts already in the list
    const existing = await prisma.contactListMember.findMany({
      where: { contactListId: listId, contactId: { in: validIds } },
      select: { contactId: true },
    });
    const existingSet = new Set(existing.map((e) => e.contactId));
    const newIds = validIds.filter((id) => !existingSet.has(id));

    if (newIds.length > 0) {
      await prisma.contactListMember.createMany({
        data: newIds.map((contactId) => ({
          contactListId: listId,
          contactId,
        })),
      });
    }

    await recountList(listId);

    return NextResponse.json({
      success: true,
      data: { added: newIds.length },
    });
  } catch (error) {
    console.error("Add contacts to list error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to add contacts to list" } },
      { status: 500 }
    );
  }
}

// DELETE /api/contact-lists/[listId]/contacts - Remove contacts from list
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const list = await prisma.contactList.findFirst({
      where: { id: listId, userId: session.userId },
    });

    if (!list) {
      return NextResponse.json(
        { success: false, error: { message: "Contact list not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { contactIds } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "contactIds must be a non-empty array" } },
        { status: 400 }
      );
    }

    const result = await prisma.contactListMember.deleteMany({
      where: {
        contactListId: listId,
        contactId: { in: contactIds },
      },
    });

    await recountList(listId);

    return NextResponse.json({
      success: true,
      data: { removed: result.count },
    });
  } catch (error) {
    console.error("Remove contacts from list error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to remove contacts from list" } },
      { status: 500 }
    );
  }
}
