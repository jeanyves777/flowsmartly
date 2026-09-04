import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { effectiveFormFields } from "@/lib/data-forms/self-entry-fields";

// GET /api/data-forms/[id] — Get data form details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const dataForm = await prisma.dataForm.findFirst({
      where: { id, userId: session.userId },
      include: { contactList: { select: { id: true, name: true } } },
    });

    if (!dataForm) {
      return NextResponse.json({ success: false, error: { message: "Data form not found" } }, { status: 404 });
    }

    // A self-entry form created before the lookup was closed has no field
    // definitions. Resolve them in memory so the builder and the submissions
    // view show the questions respondents are actually being asked; they are
    // persisted when the owner next saves the form.
    const fields = effectiveFormFields({ type: dataForm.type, fields: dataForm.fields });

    return NextResponse.json({
      success: true,
      data: {
        ...dataForm,
        fields,
        settings: JSON.parse(dataForm.settings || "{}"),
        contactListName: dataForm.contactList?.name || null,
      },
    });
  } catch (error) {
    console.error("Get data form error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch data form" } }, { status: 500 });
  }
}

// PUT /api/data-forms/[id] — Update data form
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const existing = await prisma.dataForm.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Data form not found" } }, { status: 404 });
    }

    const body = await request.json();
    // Whitelist updatable fields — never spread arbitrary body keys (userId, slug,
    // type, responseCount, sendCount, etc. must not be client-mutable).
    const { title, description, fields, status, thankYouMessage, settings, contactListId } = body;

    const data: Record<string, unknown> = {};

    if (title !== undefined) {
      const trimmed = typeof title === "string" ? title.trim() : "";
      if (!trimmed) {
        return NextResponse.json({ success: false, error: { message: "Title cannot be empty" } }, { status: 400 });
      }
      data.title = trimmed;
    }
    if (description !== undefined) {
      data.description = typeof description === "string" && description.trim() ? description.trim() : null;
    }
    if (fields !== undefined) {
      if (!Array.isArray(fields)) {
        return NextResponse.json({ success: false, error: { message: "Fields must be an array" } }, { status: 400 });
      }
      data.fields = JSON.stringify(fields);
    }
    if (thankYouMessage !== undefined) {
      data.thankYouMessage = typeof thankYouMessage === "string" ? thankYouMessage.trim() : "";
    }
    if (settings !== undefined && settings && typeof settings === "object") {
      data.settings = JSON.stringify(settings);
    }
    if (contactListId !== undefined) {
      if (contactListId) {
        const list = await prisma.contactList.findFirst({
          where: { id: contactListId, userId: session.userId },
          select: { id: true },
        });
        if (!list) {
          return NextResponse.json({ success: false, error: { message: "Contact list not found" } }, { status: 404 });
        }
        data.contactListId = contactListId;
      } else {
        data.contactListId = null;
      }
    }
    if (status !== undefined) {
      if (!["DRAFT", "ACTIVE", "CLOSED"].includes(status)) {
        return NextResponse.json({ success: false, error: { message: "Invalid status" } }, { status: 400 });
      }
      data.status = status;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: { message: "No valid fields to update" } }, { status: 400 });
    }

    const dataForm = await prisma.dataForm.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...dataForm,
        fields: JSON.parse(dataForm.fields || "[]"),
        settings: JSON.parse(dataForm.settings || "{}"),
      },
    });
  } catch (error) {
    console.error("Update data form error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update data form" } }, { status: 500 });
  }
}

// DELETE /api/data-forms/[id] — Delete data form and submissions
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const existing = await prisma.dataForm.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Data form not found" } }, { status: 404 });
    }

    // Delete submissions first, then form (cascade delete)
    await prisma.dataFormSubmission.deleteMany({ where: { formId: id } });
    await prisma.dataForm.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { message: "Data form deleted" } });
  } catch (error) {
    console.error("Delete data form error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete data form" } }, { status: 500 });
  }
}
