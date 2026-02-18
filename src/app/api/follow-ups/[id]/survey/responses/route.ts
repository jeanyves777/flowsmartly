import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/follow-ups/[id]/survey/responses — List survey responses (authenticated)
export async function GET(
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

    // Verify ownership
    const followUp = await prisma.followUp.findFirst({
      where: { id, userId: session.userId },
      include: { survey: { select: { id: true } } },
    });

    if (!followUp) {
      return NextResponse.json(
        { success: false, error: { message: "Follow-up not found" } },
        { status: 404 }
      );
    }

    if (!followUp.survey) {
      return NextResponse.json({ success: true, data: [], pagination: { total: 0 } });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");

    const [responses, total] = await Promise.all([
      prisma.surveyResponse.findMany({
        where: { surveyId: followUp.survey.id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.surveyResponse.count({
        where: { surveyId: followUp.survey.id },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: responses.map((r) => ({
        ...r,
        answers: JSON.parse(r.answers || "{}"),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List survey responses error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch responses" } },
      { status: 500 }
    );
  }
}
