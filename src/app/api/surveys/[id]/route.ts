import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/surveys/[id] — Get survey details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const survey = await prisma.survey.findFirst({
      where: { id, userId: session.userId },
      include: { contactList: { select: { id: true, name: true } } },
    });

    if (!survey) {
      return NextResponse.json({ success: false, error: { message: "Survey not found" } }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...survey,
        questions: JSON.parse(survey.questions || "[]"),
        contactListName: survey.contactList?.name || null,
      },
    });
  } catch (error) {
    console.error("Get survey error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch survey" } }, { status: 500 });
  }
}

// PUT /api/surveys/[id] — Update survey
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const existing = await prisma.survey.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Survey not found" } }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, questions, thankYouMessage, isActive, status, contactListId } = body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (questions !== undefined) data.questions = JSON.stringify(questions);
    if (thankYouMessage !== undefined) data.thankYouMessage = thankYouMessage.trim();
    if (isActive !== undefined) data.isActive = isActive;
    if (status !== undefined) data.status = status;
    if (contactListId !== undefined) data.contactListId = contactListId || null;

    const survey = await prisma.survey.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: { ...survey, questions: JSON.parse(survey.questions || "[]") },
    });
  } catch (error) {
    console.error("Update survey error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update survey" } }, { status: 500 });
  }
}

// DELETE /api/surveys/[id] — Delete survey and responses
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const existing = await prisma.survey.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Survey not found" } }, { status: 404 });
    }

    // Delete responses first, then survey
    await prisma.surveyResponse.deleteMany({ where: { surveyId: id } });
    await prisma.survey.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { message: "Survey deleted" } });
  } catch (error) {
    console.error("Delete survey error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete survey" } }, { status: 500 });
  }
}
