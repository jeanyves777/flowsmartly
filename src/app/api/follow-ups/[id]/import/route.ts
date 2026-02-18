import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// POST /api/follow-ups/[id]/import — Bulk import entries from a contact list
export async function POST(
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
      select: { id: true },
    });

    if (!followUp) {
      return NextResponse.json(
        { success: false, error: { message: "Follow-up not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { contactListId } = body;

    if (!contactListId) {
      return NextResponse.json(
        { success: false, error: { message: "Contact list ID is required" } },
        { status: 400 }
      );
    }

    // Verify contact list ownership
    const contactList = await prisma.contactList.findFirst({
      where: { id: contactListId, userId: session.userId },
      select: { id: true, name: true },
    });

    if (!contactList) {
      return NextResponse.json(
        { success: false, error: { message: "Contact list not found" } },
        { status: 404 }
      );
    }

    // Get all contacts in the list
    const members = await prisma.contactListMember.findMany({
      where: { contactListId },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            address: true,
          },
        },
      },
    });

    // Get existing entries to skip duplicates
    const existingEntries = await prisma.followUpEntry.findMany({
      where: { followUpId: id, contactId: { not: null } },
      select: { contactId: true },
    });
    const existingContactIds = new Set(existingEntries.map((e) => e.contactId));

    // Filter out contacts that already have entries
    const newContacts = members.filter(
      (m) => !existingContactIds.has(m.contact.id)
    );

    if (newContacts.length === 0) {
      return NextResponse.json({
        success: true,
        data: { imported: 0, skipped: members.length, message: "All contacts are already in this follow-up" },
      });
    }

    // Create entries for new contacts
    await prisma.followUpEntry.createMany({
      data: newContacts.map((m) => ({
        followUpId: id,
        contactId: m.contact.id,
        name: [m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || null,
        phone: m.contact.phone,
        email: m.contact.email,
        address: m.contact.address,
        status: "PENDING",
      })),
    });

    // Update counter
    await prisma.followUp.update({
      where: { id },
      data: { totalEntries: { increment: newContacts.length } },
    });

    return NextResponse.json({
      success: true,
      data: {
        imported: newContacts.length,
        skipped: members.length - newContacts.length,
        message: `Imported ${newContacts.length} contacts from "${contactList.name}"`,
      },
    });
  } catch (error) {
    console.error("Import entries error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to import contacts" } },
      { status: 500 }
    );
  }
}
