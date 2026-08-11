import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { effectiveFormFields } from "@/lib/data-forms/self-entry-fields";
import {
  buildContactSyncPlan,
  initialConsentFields,
  submittedValue,
} from "@/lib/data-forms/contact-sync";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = await params;

    const form = await prisma.dataForm.findFirst({
      where: { id, userId: session.userId },
      select: { userId: true, type: true, fields: true, title: true },
    });

    if (!form) {
      return NextResponse.json({ success: false, error: { message: "Form not found" } }, { status: 404 });
    }

    const body = await request.json();
    const { listId: rawListId, submissionIds, createNewList, newListName } = body;

    let listId: string | undefined = rawListId;

    if (createNewList) {
      const name = ((newListName as string) || form.title || "").trim();
      if (!name) {
        return NextResponse.json({ success: false, error: { message: "List name is required" } }, { status: 400 });
      }
      const newList = await prisma.contactList.create({
        data: { userId: session.userId, name },
      });
      listId = newList.id;
    }

    if (listId) {
      const list = await prisma.contactList.findFirst({
        where: { id: listId, userId: session.userId },
      });
      if (!list) {
        return NextResponse.json({ success: false, error: { message: "Contact list not found" } }, { status: 404 });
      }
    }

    const where: Record<string, unknown> = { formId: id };
    if (submissionIds && Array.isArray(submissionIds) && submissionIds.length > 0) {
      where.id = { in: submissionIds };
    }

    const submissions = await prisma.dataFormSubmission.findMany({ where });
    // Same resolver as both form reads, so legacy forms are understood
    // identically everywhere without anyone writing.
    const fields = effectiveFormFields({ type: form.type, fields: form.fields });

    let created = 0;
    let linked = 0;
    let skipped = 0;
    // Existing contacts whose gaps this sync closed.
    let filled = 0;
    // SMS boxes ticked but not promoted to an opt-in — see
    // SMS_CONSENT_IS_AUTHORITATIVE. The answer stays on the submission.
    let smsConsentPending = 0;

    for (const submission of submissions) {
      const data = JSON.parse(submission.data || "{}");

      let email = submission.respondentEmail;
      if (!email) {
        const emailField = fields.find((f: { type: string }) => f.type === "email");
        if (emailField) email = data[emailField.id]?.trim() || null;
      }

      let phone = submission.respondentPhone;
      if (!phone) {
        const phoneField = fields.find((f: { type: string }) => f.type === "phone");
        if (phoneField) phone = data[phoneField.id]?.trim() || null;
      }

      let name = submission.respondentName;
      if (!name) {
        const nameField = fields.find(
          (f: { type: string; label: string }) =>
            f.type === "text" && f.label.toLowerCase().includes("name")
        );
        if (nameField) name = data[nameField.id]?.trim() || null;
      }

      // Self-entry forms label their fields with the contact column they mean,
      // so take them directly rather than inferring from field type — the
      // heuristics above find "First name" and drop the surname entirely, and
      // never carry birthday, address, city or state at all.
      const direct = (key: string) => submittedValue(data, key);
      const directFirstName = direct("firstName");
      const directLastName = direct("lastName");
      if (directFirstName || directLastName) {
        name = [directFirstName, directLastName].filter(Boolean).join(" ") || name;
      }
      email = email || direct("email");
      phone = phone || direct("phone");

      if (!email && !phone) {
        skipped++;
        continue;
      }

      const nameParts = (name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || null;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

      let contact = null;
      if (email) {
        contact = await prisma.contact.findUnique({
          where: { userId_email: { userId: session.userId, email } },
        });
      }
      if (!contact && phone) {
        contact = await prisma.contact.findUnique({
          where: { userId_phone: { userId: session.userId, phone } },
        });
      }

      if (contact) {
        // email and phone are unique per owner, so they may only be filled when
        // absent AND unclaimed by another contact. Resolve that first — the
        // channel a consent tick refers to may be supplied by this very
        // submission, so consent has to be judged against the contact as it
        // will be, not as it was.
        const approvedChannels: { email?: string | null; phone?: string | null } = {};
        if (!contact.email && email) {
          const clash = await prisma.contact.findFirst({
            where: { userId: session.userId, email, id: { not: contact.id } },
            select: { id: true },
          });
          if (!clash) approvedChannels.email = email;
        }
        if (!contact.phone && phone) {
          const clash = await prisma.contact.findFirst({
            where: { userId: session.userId, phone, id: { not: contact.id } },
            select: { id: true },
          });
          if (!clash) approvedChannels.phone = phone;
        }

        // Fill the gaps this respondent just closed, never overwriting a value
        // the owner already holds, and grant consent against the result.
        const plan = buildContactSyncPlan(contact, data, approvedChannels);
        if (plan.smsConsentWithheld) smsConsentPending++;

        if (Object.keys(plan.update).length > 0) {
          await prisma.contact.update({ where: { id: contact.id }, data: plan.update });
          filled++;
        }

        if (listId) {
          const alreadyInList = await prisma.contactListMember.findUnique({
            where: {
              contactListId_contactId: {
                contactListId: listId,
                contactId: contact.id,
              },
            },
          });
          if (!alreadyInList) {
            await prisma.contactListMember.create({
              data: { contactListId: listId, contactId: contact.id },
            });
            await prisma.contactList.update({
              where: { id: listId },
              data: { totalCount: { increment: 1 }, activeCount: { increment: 1 } },
            });
            linked++;
          } else {
            skipped++;
          }
        } else {
          linked++;
        }
        continue;
      }

      // Consent is what the respondent agreed to, never what they supplied.
      // Having someone's address is not permission to market to them, and an
      // owner clicking Sync does not turn contact information into consent.
      const newContact = await prisma.contact.create({
        data: {
          userId: session.userId,
          email,
          phone,
          firstName,
          lastName,
          birthday: direct("birthday"),
          address: direct("address"),
          city: direct("city"),
          state: direct("state"),
          ...initialConsentFields(data, email, phone),
        },
      });

      if (listId) {
        await prisma.contactListMember.create({
          data: { contactListId: listId, contactId: newContact.id },
        });
        await prisma.contactList.update({
          where: { id: listId },
          data: { totalCount: { increment: 1 }, activeCount: { increment: 1 } },
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
        filled,
        smsConsentPending,
        total: submissions.length,
        listId: listId || null,
        message: `Synced ${created} new contacts${linked > 0 ? `, linked ${linked} existing` : ""}${filled > 0 ? `, filled gaps on ${filled}` : ""}${skipped > 0 ? `, ${skipped} skipped` : ""}`,
      },
    });
  } catch (error) {
    console.error("Sync contacts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to sync contacts" } },
      { status: 500 }
    );
  }
}
