import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify form ownership
    const form = await prisma.dataForm.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { formId: id };
    if (search) {
      where.OR = [
        { respondentName: { contains: search, mode: "insensitive" } },
        { respondentEmail: { contains: search, mode: "insensitive" } },
        { respondentPhone: { contains: search } },
      ];
    }

    const [submissions, total] = await Promise.all([
      prisma.dataFormSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.dataFormSubmission.count({ where }),
    ]);

    // Parse data JSON for each submission
    const parsedSubmissions = submissions.map((submission) => ({
      ...submission,
      data: submission.data ? JSON.parse(submission.data) : {},
    }));

    return NextResponse.json({
      submissions: parsedSubmissions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify form ownership
    const form = await prisma.dataForm.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Invalid submission IDs" },
        { status: 400 }
      );
    }

    // Delete submissions
    const result = await prisma.dataFormSubmission.deleteMany({
      where: {
        id: { in: ids },
        formId: id,
      },
    });

    // Decrement response count
    if (result.count > 0) {
      await prisma.dataForm.update({
        where: { id },
        data: { responseCount: { decrement: result.count } },
      });
    }

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("Error deleting submissions:", error);
    return NextResponse.json(
      { error: "Failed to delete submissions" },
      { status: 500 }
    );
  }
}
