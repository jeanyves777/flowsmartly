import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { SMART_COLLECT_FIELDS } from "@/types/data-form";

// POST /api/data-forms/public/[slug]/complete
// Updates a contact with missing fields submitted via Smart Collect form
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

    // Fetch form and verify
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

    if (!form || form.status !== "ACTIVE" || form.type !== "SMART_COLLECT" || !form.contactListId) {
      return NextResponse.json(
        { success: false, error: { message: "Form not found or not configured" } },
        { status: 404 }
      );
    }

    // Verify contact belongs to this user and is in the linked list
    const membership = await prisma.contactListMember.findFirst({
      where: {
        contactListId: form.contactListId,
        contactId,
        contact: { userId: form.userId, status: "ACTIVE" },
      },
      include: {
        contact: {
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
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { message: "Contact not found" } },
        { status: 404 }
      );
    }

    // Only update fields that are currently empty on the contact
    const contact = membership.contact;
    const allowedKeys = SMART_COLLECT_FIELDS.map((f) => f.key) as string[];
    const updateData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (!allowedKeys.includes(key)) continue;
      const strVal = String(value).trim();
      if (!strVal) continue;

      // Only fill in if currently empty
      const currentVal = contact[key as keyof typeof contact];
      if (currentVal && String(currentVal).trim()) continue;

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

    if (!form || form.status !== "ACTIVE" || form.type !== "SMART_COLLECT" || !form.contactListId) {
      return NextResponse.json(
        { success: false, error: { message: "Form not found" } },
        { status: 404 }
      );
    }

    const membership = await prisma.contactListMember.findFirst({
      where: {
        contactListId: form.contactListId,
        contactId,
        contact: { userId: form.userId, status: "ACTIVE" },
      },
      include: {
        contact: {
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
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { message: "Contact not found" } },
        { status: 404 }
      );
    }

    const contact = membership.contact;
    const missingFields: { key: string; label: string; type: string }[] = [];
    const existingFields: { key: string; label: string; value: string }[] = [];

    for (const field of SMART_COLLECT_FIELDS) {
      const val = contact[field.key as keyof typeof contact];
      if (val && String(val).trim()) {
        existingFields.push({ key: field.key, label: field.label, value: String(val) });
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
