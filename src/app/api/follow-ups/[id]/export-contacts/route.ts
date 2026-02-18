import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// POST /api/follow-ups/[id]/export-contacts - Push follow-up entries to user's Contacts
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
    const body = await request.json();
    const { listId, entryIds } = body as {
      listId?: string;
      entryIds?: string[];
    };

    // Verify ownership
    const followUp = await prisma.followUp.findFirst({
      where: { id, userId: session.userId },
    });

    if (!followUp) {
      return NextResponse.json(
        { success: false, error: { message: "Follow-up not found" } },
        { status: 404 }
      );
    }

    // Verify list ownership if provided
    if (listId) {
      const list = await prisma.contactList.findFirst({
        where: { id: listId, userId: session.userId },
      });
      if (!list) {
        return NextResponse.json(
          { success: false, error: { message: "Contact list not found" } },
          { status: 404 }
        );
      }
    }

    // Get entries to export
    const whereEntries: Record<string, unknown> = { followUpId: id };
    if (entryIds && entryIds.length > 0) {
      whereEntries.id = { in: entryIds };
    }

    const entries = await prisma.followUpEntry.findMany({
      where: whereEntries,
      include: { contact: true },
    });

    if (entries.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "No entries to export" } },
        { status: 400 }
      );
    }

    let created = 0;
    let skipped = 0;
    let linked = 0;

    for (const entry of entries) {
      // Skip entries that are already linked to a contact
      if (entry.contactId && entry.contact) {
        // If a list was specified, add existing contact to that list
        if (listId) {
          const alreadyInList = await prisma.contactListMember.findUnique({
            where: {
              contactListId_contactId: {
                contactListId: listId,
                contactId: entry.contactId,
              },
            },
          });
          if (!alreadyInList) {
            await prisma.contactListMember.create({
              data: { contactListId: listId, contactId: entry.contactId },
            });
            await prisma.contactList.update({
              where: { id: listId },
              data: {
                totalCount: { increment: 1 },
                activeCount: { increment: 1 },
              },
            });
            linked++;
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
        continue;
      }

      // Need at least email or phone to create a contact
      const email = entry.email?.trim() || null;
      const phone = entry.phone?.trim() || null;

      if (!email && !phone) {
        skipped++;
        continue;
      }

      // Check for existing contact by email or phone
      let existingContact = null;
      if (email) {
        existingContact = await prisma.contact.findUnique({
          where: { userId_email: { userId: session.userId, email } },
        });
      }
      if (!existingContact && phone) {
        existingContact = await prisma.contact.findUnique({
          where: { userId_phone: { userId: session.userId, phone } },
        });
      }

      if (existingContact) {
        // Link the entry to the existing contact
        await prisma.followUpEntry.update({
          where: { id: entry.id },
          data: { contactId: existingContact.id },
        });

        // Add to list if specified
        if (listId) {
          const alreadyInList = await prisma.contactListMember.findUnique({
            where: {
              contactListId_contactId: {
                contactListId: listId,
                contactId: existingContact.id,
              },
            },
          });
          if (!alreadyInList) {
            await prisma.contactListMember.create({
              data: { contactListId: listId, contactId: existingContact.id },
            });
            await prisma.contactList.update({
              where: { id: listId },
              data: {
                totalCount: { increment: 1 },
                activeCount: { increment: 1 },
              },
            });
          }
        }

        linked++;
        continue;
      }

      // Parse name into firstName/lastName
      const nameParts = (entry.name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || null;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

      // Create new contact
      const newContact = await prisma.contact.create({
        data: {
          userId: session.userId,
          email,
          phone,
          firstName,
          lastName,
          address: entry.address || null,
          emailOptedIn: !!email,
          emailOptedInAt: email ? new Date() : null,
          smsOptedIn: !!phone,
          smsOptedInAt: phone ? new Date() : null,
        },
      });

      // Link entry to the new contact
      await prisma.followUpEntry.update({
        where: { id: entry.id },
        data: { contactId: newContact.id },
      });

      // Add to list if specified
      if (listId) {
        await prisma.contactListMember.create({
          data: { contactListId: listId, contactId: newContact.id },
        });
        await prisma.contactList.update({
          where: { id: listId },
          data: {
            totalCount: { increment: 1 },
            activeCount: { increment: 1 },
          },
        });
      }

      created++;
    }

    return NextResponse.json({
      success: true,
      data: {
        created,
        linked,
        skipped,
        total: entries.length,
        message: `Exported ${created} new contacts${linked > 0 ? `, linked ${linked} existing` : ""}${skipped > 0 ? `, ${skipped} skipped` : ""}`,
      },
    });
  } catch (error) {
    console.error("Export contacts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to export contacts" } },
      { status: 500 }
    );
  }
}
