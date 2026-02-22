import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

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
    });

    if (!dataForm) {
      return NextResponse.json({ success: false, error: { message: "Data form not found" } }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...dataForm,
        fields: JSON.parse(dataForm.fields || "[]"),
        settings: JSON.parse(dataForm.settings || "{}"),
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
    const { title, description, fields, status, thankYouMessage, settings } = body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (fields !== undefined) data.fields = JSON.stringify(fields);
    if (thankYouMessage !== undefined) data.thankYouMessage = thankYouMessage.trim();
    if (settings !== undefined) data.settings = JSON.stringify(settings);
    if (status !== undefined) {
      if (!["DRAFT", "ACTIVE", "CLOSED"].includes(status)) {
        return NextResponse.json({ success: false, error: { message: "Invalid status" } }, { status: 400 });
      }
      data.status = status;
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
