import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

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
      select: { userId: true, fields: true },
    });

    if (!form) {
      return NextResponse.json({ success: false, error: { message: "Form not found" } }, { status: 404 });
    }

    const body = await request.json();
    const { listId, submissionIds } = body;

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
    const fields = JSON.parse(form.fields || "[]");

    let created = 0;
    let linked = 0;
    let skipped = 0;

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

      const newContact = await prisma.contact.create({
        data: {
          userId: session.userId,
          email,
          phone,
          firstName,
          lastName,
          emailOptedIn: !!email,
          emailOptedInAt: email ? new Date() : null,
          smsOptedIn: !!phone,
          smsOptedInAt: phone ? new Date() : null,
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
        total: submissions.length,
        message: `Synced ${created} new contacts${linked > 0 ? `, linked ${linked} existing` : ""}${skipped > 0 ? `, ${skipped} skipped` : ""}`,
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
