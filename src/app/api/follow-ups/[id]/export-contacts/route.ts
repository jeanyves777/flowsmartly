import { NextRequest, NextResponse } from "next/server";
import { buildFollowUpContactData } from "@/lib/contacts/contact-intake";
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

    // Hard cap so a single export can't run unbounded. We log if truncated
    // (no silent caps rule) and report it in the response.
    const MAX_ENTRIES = 5000;

    // Get entries to export
    const whereEntries: Record<string, unknown> = { followUpId: id };
    if (entryIds && entryIds.length > 0) {
      whereEntries.id = { in: entryIds };
    }

    const totalMatching = await prisma.followUpEntry.count({ where: whereEntries });
    const truncated = totalMatching > MAX_ENTRIES;
    if (truncated) {
      console.warn(
        `export-contacts: follow-up ${id} has ${totalMatching} entries, processing first ${MAX_ENTRIES}`
      );
    }

    const entries = await prisma.followUpEntry.findMany({
      where: whereEntries,
      select: {
        id: true,
        contactId: true,
        name: true,
        email: true,
        phone: true,
        address: true,
      },
      orderBy: { createdAt: "asc" },
      take: MAX_ENTRIES,
    });

    if (entries.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "No entries to export" } },
        { status: 400 }
      );
    }

    // Normalize email/phone once per entry
    const normalized = entries.map((e) => ({
      id: e.id,
      contactId: e.contactId,
      name: (e.name || "").trim(),
      email: e.email?.trim() || null,
      phone: e.phone?.trim() || null,
      address: e.address?.trim() || null,
    }));

    // (1) Batch-load existing contacts for this user by the set of emails/phones
    const emailSet = Array.from(
      new Set(normalized.map((e) => e.email).filter((v): v is string => !!v))
    );
    const phoneSet = Array.from(
      new Set(normalized.map((e) => e.phone).filter((v): v is string => !!v))
    );

    const [existingByEmailRows, existingByPhoneRows] = await Promise.all([
      emailSet.length
        ? prisma.contact.findMany({
            where: { userId: session.userId, email: { in: emailSet } },
            select: { id: true, email: true },
          })
        : Promise.resolve([] as { id: string; email: string | null }[]),
      phoneSet.length
        ? prisma.contact.findMany({
            where: { userId: session.userId, phone: { in: phoneSet } },
            select: { id: true, phone: true },
          })
        : Promise.resolve([] as { id: string; phone: string | null }[]),
    ]);

    const contactByEmail = new Map<string, string>();
    for (const c of existingByEmailRows) if (c.email) contactByEmail.set(c.email, c.id);
    const contactByPhone = new Map<string, string>();
    for (const c of existingByPhoneRows) if (c.phone) contactByPhone.set(c.phone, c.id);

    let created = 0;
    let skipped = 0;
    let linked = 0;

    // (2) Build the create / link plan in memory.
    // resolvedContactId per entry → used to link entry + build list membership set.
    const entryLinkUpdates: { entryId: string; contactId: string }[] = [];
    const contactIdsForList = new Set<string>(); // contacts to add to the target list

    // New contacts to create (dedup by email/phone within this batch).
    const newContactsData: Array<{
      userId: string;
      email: string | null;
      phone: string | null;
      firstName: string | null;
      lastName: string | null;
      address: string | null;
      emailOptedIn: boolean;
      emailOptedInAt: Date | null;
      smsOptedIn: boolean;
      smsOptedInAt: Date | null;
    }> = [];
    // Map an entry to the email/phone key of a to-be-created contact so we can
    // resolve the real id after createMany.
    const pendingNew: { entryId: string; email: string | null; phone: string | null }[] = [];
    const plannedNewKeys = new Set<string>(); // de-dupe new contacts within the batch

    for (const e of normalized) {
      // Already linked to a contact
      if (e.contactId) {
        if (listId) {
          contactIdsForList.add(e.contactId);
          linked++;
        } else {
          skipped++;
        }
        continue;
      }

      // Need at least email or phone to create a contact
      if (!e.email && !e.phone) {
        skipped++;
        continue;
      }

      const existingId =
        (e.email && contactByEmail.get(e.email)) ||
        (e.phone && contactByPhone.get(e.phone)) ||
        null;

      if (existingId) {
        entryLinkUpdates.push({ entryId: e.id, contactId: existingId });
        if (listId) contactIdsForList.add(existingId);
        linked++;
        continue;
      }

      // Plan a new contact — dedupe within the batch by email/phone key
      const key = `${e.email || ""}|${e.phone || ""}`;
      if (plannedNewKeys.has(key)) {
        // Another entry in this batch already plans this contact; link after create.
        pendingNew.push({ entryId: e.id, email: e.email, phone: e.phone });
        continue;
      }
      plannedNewKeys.add(key);

      // Consent is NOT implied by the entry holding a channel — see
      // buildFollowUpContactData.
      newContactsData.push(
        buildFollowUpContactData({
          userId: session.userId,
          email: e.email,
          phone: e.phone,
          name: e.name,
          address: e.address,
        })
      );
      pendingNew.push({ entryId: e.id, email: e.email, phone: e.phone });
      created++;
    }

    // (3) Transactional writes: createMany new contacts, then resolve ids,
    // link entries, createMany list members, and fix the list count.
    await prisma.$transaction(async (tx) => {
      // New contacts are pre-filtered: every email/phone in this batch was
      // checked against the user's existing contacts, and the batch is deduped
      // by email/phone key — so none collide with the unique constraints.
      if (newContactsData.length > 0) {
        await tx.contact.createMany({ data: newContactsData });
      }

      // Resolve ids for the newly created (or now-existing) contacts.
      if (pendingNew.length > 0) {
        const newEmails = Array.from(
          new Set(pendingNew.map((p) => p.email).filter((v): v is string => !!v))
        );
        const newPhones = Array.from(
          new Set(pendingNew.map((p) => p.phone).filter((v): v is string => !!v))
        );
        const [emailRows, phoneRows] = await Promise.all([
          newEmails.length
            ? tx.contact.findMany({
                where: { userId: session.userId, email: { in: newEmails } },
                select: { id: true, email: true },
              })
            : Promise.resolve([] as { id: string; email: string | null }[]),
          newPhones.length
            ? tx.contact.findMany({
                where: { userId: session.userId, phone: { in: newPhones } },
                select: { id: true, phone: true },
              })
            : Promise.resolve([] as { id: string; phone: string | null }[]),
        ]);
        const byEmail = new Map<string, string>();
        for (const c of emailRows) if (c.email) byEmail.set(c.email, c.id);
        const byPhone = new Map<string, string>();
        for (const c of phoneRows) if (c.phone) byPhone.set(c.phone, c.id);

        for (const p of pendingNew) {
          const cid = (p.email && byEmail.get(p.email)) || (p.phone && byPhone.get(p.phone)) || null;
          if (cid) {
            entryLinkUpdates.push({ entryId: p.entryId, contactId: cid });
            if (listId) contactIdsForList.add(cid);
          }
        }
      }

      // Link entries to their resolved contacts (grouped by contactId to batch updates).
      const byContact = new Map<string, string[]>();
      for (const u of entryLinkUpdates) {
        const arr = byContact.get(u.contactId) || [];
        arr.push(u.entryId);
        byContact.set(u.contactId, arr);
      }
      for (const [contactId, entryIdList] of byContact) {
        await tx.followUpEntry.updateMany({
          where: { id: { in: entryIdList } },
          data: { contactId },
        });
      }

      // Add contacts to the target list. Pre-filter against existing membership
      // so we never collide on the (contactListId, contactId) unique constraint.
      if (listId && contactIdsForList.size > 0) {
        const candidateIds = Array.from(contactIdsForList);
        const existingMembers = await tx.contactListMember.findMany({
          where: { contactListId: listId, contactId: { in: candidateIds } },
          select: { contactId: true },
        });
        const alreadyMember = new Set(existingMembers.map((m) => m.contactId));
        const toAdd = candidateIds.filter((cid) => !alreadyMember.has(cid));

        if (toAdd.length > 0) {
          await tx.contactListMember.createMany({
            data: toAdd.map((contactId) => ({ contactListId: listId, contactId })),
          });
        }
        // Set the list's counts to the REAL member count (no blind increments).
        const memberCount = await tx.contactListMember.count({
          where: { contactListId: listId },
        });
        await tx.contactList.update({
          where: { id: listId },
          data: { totalCount: memberCount, activeCount: memberCount },
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        created,
        linked,
        skipped,
        total: entries.length,
        truncated,
        message:
          `Exported ${created} new contacts${linked > 0 ? `, linked ${linked} existing` : ""}${skipped > 0 ? `, ${skipped} skipped` : ""}` +
          (truncated ? ` (only the first ${MAX_ENTRIES} of ${totalMatching} entries processed)` : ""),
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
