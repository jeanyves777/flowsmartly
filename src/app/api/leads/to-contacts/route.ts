import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import type { BusinessLead } from "../search/route";

// POST /api/leads/to-contacts — convert selected leads to a contact list
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await request.json();
    const { searchId, selectedLeads, listName, existingListId } = body;

    if (!selectedLeads || !Array.isArray(selectedLeads) || selectedLeads.length === 0) {
      return NextResponse.json({ success: false, error: { message: "No leads selected" } }, { status: 400 });
    }

    // Get or create contact list
    let listId: string;
    if (existingListId) {
      const list = await prisma.contactList.findFirst({ where: { id: existingListId, userId: session.userId } });
      if (!list) return NextResponse.json({ success: false, error: { message: "Contact list not found" } }, { status: 404 });
      listId = existingListId;
    } else {
      const name = listName?.trim() || `Leads — ${new Date().toLocaleDateString()}`;
      const newList = await prisma.contactList.create({ data: { userId: session.userId, name } });
      listId = newList.id;
    }

    let created = 0;
    let skipped = 0;
    let linked = 0;

    for (const lead of selectedLeads as BusinessLead[]) {
      if (!lead.name) { skipped++; continue; }

      const nameParts = lead.name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || null;

      // Check if contact already exists (by phone or name — no email from Google Places usually)
      let contact = null;
      if (lead.phone) {
        contact = await prisma.contact.findUnique({
          where: { userId_phone: { userId: session.userId, phone: lead.phone } },
        });
      }

      if (!contact) {
        // Create new contact
        contact = await prisma.contact.create({
          data: {
            userId: session.userId,
            firstName,
            lastName,
            phone: lead.phone || null,
            company: lead.name,
            address: lead.address || null,
            tags: JSON.stringify(["lead", "google-places"]),
          },
        });
        created++;
      }

      // Add to list if not already there
      const existing = await prisma.contactListMember.findUnique({
        where: { contactListId_contactId: { contactListId: listId, contactId: contact.id } },
      });
      if (!existing) {
        await prisma.contactListMember.create({
          data: { contactListId: listId, contactId: contact.id },
        });
        linked++;
      } else {
        skipped++;
      }
    }

    // Update list counts
    const [total, active] = await Promise.all([
      prisma.contactListMember.count({ where: { contactListId: listId } }),
      prisma.contactListMember.count({ where: { contactListId: listId, contact: { status: "ACTIVE" } } }),
    ]);
    await prisma.contactList.update({
      where: { id: listId },
      data: { totalCount: total, activeCount: active },
    });

    return NextResponse.json({
      success: true,
      data: { listId, created, linked, skipped, total: selectedLeads.length },
    });
  } catch (error) {
    console.error("Leads to contacts error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to import leads" } }, { status: 500 });
  }
}
