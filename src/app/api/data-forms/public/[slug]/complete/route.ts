import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { SMART_COLLECT_FIELDS } from "@/types/data-form";

// POST /api/data-forms/public/[slug]/complete
// Updates a contact with missing fields, then adds them to the linked list
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { contactId, data } = body as { contactId: string; data: Record<string, string> };

    if (!contactId || !data || typeof data !== "object") {
      return NextResponse.json(
        { success: false, error: { message: "contactId and data are required" } },
        { status: 400 }
      );
    }

    const form = await prisma.dataForm.findUnique({
      where: { slug },
      select: {
        id: true,
        type: true,
        status: true,
        contactListId: true,
        userId: true,
      },
    });

    if (!form || form.status !== "ACTIVE" || form.type !== "SMART_COLLECT") {
      return NextResponse.json(
        { success: false, error: { message: "Form not found or not configured" } },
        { status: 404 }
      );
    }

    // Find the contact (any contact belonging to this user, not limited to a list)
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: form.userId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        birthday: true,
        address: true,
        city: true,
        state: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: { message: "Contact not found" } },
        { status: 404 }
      );
    }

    // Merge: collect all known data from this contact + siblings with same name
    const allowedKeys = SMART_COLLECT_FIELDS.map((f) => f.key) as string[];
    const knownData: Record<string, string> = {};
    for (const key of allowedKeys) {
      const val = contact[key as keyof typeof contact];
      if (val && String(val).trim()) knownData[key] = String(val);
    }

    // Pull data from sibling contacts with the same first name
    if (contact.firstName) {
      const siblings = await prisma.contact.findMany({
        where: {
          userId: form.userId,
          status: "ACTIVE",
          id: { not: contactId },
          firstName: { equals: contact.firstName, mode: "insensitive" },
        },
        select: { lastName: true, email: true, phone: true, birthday: true, address: true, city: true, state: true },
      });
      for (const sib of siblings) {
        for (const key of allowedKeys) {
          if (knownData[key]) continue;
          const val = sib[key as keyof typeof sib];
          if (val && String(val).trim()) knownData[key] = String(val);
        }
      }
    }

    // Build update: use submitted data + sibling-merged data for empty fields
    const updateData: Record<string, unknown> = {};

    for (const key of allowedKeys) {
      // Already on this contact record — skip
      const currentVal = contact[key as keyof typeof contact];
      if (currentVal && String(currentVal).trim()) continue;

      // Try submitted value first, then sibling-merged value
      const submittedVal = data[key] ? String(data[key]).trim() : "";
      const mergedVal = knownData[key] || "";
      const strVal = submittedVal || mergedVal;
      if (!strVal) continue;

      // Validate birthday format
      if (key === "birthday") {
        if (!/^\d{2}-\d{2}$/.test(strVal)) continue;
        const [mm, dd] = strVal.split("-").map(Number);
        if (mm < 1 || mm > 12 || dd < 1 || dd > 31) continue;
      }

      // Validate email format
      if (key === "email") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) continue;
      }

      updateData[key] = strVal;
    }

    // Set opt-in flags if email/phone provided
    if (updateData.email) {
      updateData.emailOptedIn = true;
      updateData.emailOptedInAt = new Date();
    }
    if (updateData.phone) {
      updateData.smsOptedIn = true;
      updateData.smsOptedInAt = new Date();
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.contact.update({
        where: { id: contactId },
        data: updateData,
      });
    }

    // Add contact to the linked list if not already a member
    if (form.contactListId) {
      const existingMember = await prisma.contactListMember.findFirst({
        where: { contactListId: form.contactListId, contactId },
      });
      if (!existingMember) {
        await prisma.contactListMember.create({
          data: {
            contactListId: form.contactListId,
            contactId,
          },
        });
        // Update list counts
        const counts = await prisma.contactListMember.count({
          where: { contactListId: form.contactListId },
        });
        const activeCounts = await prisma.contactListMember.count({
          where: {
            contactListId: form.contactListId,
            contact: { status: "ACTIVE" },
          },
        });
        await prisma.contactList.update({
          where: { id: form.contactListId },
          data: { totalCount: counts, activeCount: activeCounts },
        });
      }
    }

    // Record as a form submission for tracking
    await prisma.dataFormSubmission.create({
      data: {
        formId: form.id,
        data: JSON.stringify(data),
        respondentName: contact.firstName || null,
        respondentEmail: (updateData.email as string) || contact.email || null,
        respondentPhone: (updateData.phone as string) || contact.phone || null,
      },
    });

    await prisma.dataForm.update({
      where: { id: form.id },
      data: { responseCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: { updated: Object.keys(updateData).length },
    });
  } catch (error) {
    console.error("Smart collect complete error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update contact" } },
      { status: 500 }
    );
  }
}

// GET /api/data-forms/public/[slug]/complete?contactId=xxx
// Returns which fields are missing for a contact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const contactId = request.nextUrl.searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: { message: "contactId is required" } },
        { status: 400 }
      );
    }

    const form = await prisma.dataForm.findUnique({
      where: { slug },
      select: {
        id: true,
        type: true,
        status: true,
        contactListId: true,
        userId: true,
      },
    });

    if (!form || form.status !== "ACTIVE" || form.type !== "SMART_COLLECT") {
      return NextResponse.json(
        { success: false, error: { message: "Form not found" } },
        { status: 404 }
      );
    }

    // Find the selected contact
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: form.userId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        birthday: true,
        address: true,
        city: true,
        state: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: { message: "Contact not found" } },
        { status: 404 }
      );
    }

    // Merge data from other contacts with the same first name
    // (handles duplicates like birthday-list-only records vs full contacts)
    const merged: Record<string, string> = {};
    for (const field of SMART_COLLECT_FIELDS) {
      const val = contact[field.key as keyof typeof contact];
      if (val && String(val).trim()) {
        merged[field.key] = String(val);
      }
    }

    // Check if any fields are still missing — look for matches by name
    const missingKeys = SMART_COLLECT_FIELDS.filter((f) => !merged[f.key]).map((f) => f.key);
    if (missingKeys.length > 0 && contact.firstName) {
      const siblings = await prisma.contact.findMany({
        where: {
          userId: form.userId,
          status: "ACTIVE",
          id: { not: contactId },
          firstName: { equals: contact.firstName, mode: "insensitive" },
        },
        select: {
          lastName: true,
          email: true,
          phone: true,
          birthday: true,
          address: true,
          city: true,
          state: true,
        },
      });

      for (const sibling of siblings) {
        for (const key of missingKeys) {
          if (merged[key]) continue;
          const val = sibling[key as keyof typeof sibling];
          if (val && String(val).trim()) {
            merged[key] = String(val);
          }
        }
      }
    }

    const missingFields: { key: string; label: string; type: string }[] = [];
    const existingFields: { key: string; label: string; value: string }[] = [];

    for (const field of SMART_COLLECT_FIELDS) {
      if (merged[field.key]) {
        existingFields.push({ key: field.key, label: field.label, value: merged[field.key] });
      } else {
        missingFields.push({ key: field.key, label: field.label, type: field.type });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        contact: {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
        },
        missingFields,
        existingFields,
        isComplete: missingFields.length === 0,
      },
    });
  } catch (error) {
    console.error("Smart collect check error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to check contact" } },
      { status: 500 }
    );
  }
}
