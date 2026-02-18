import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/surveys/[id]/responses — List survey responses
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
      select: { id: true },
    });

    if (!survey) {
      return NextResponse.json({ success: false, error: { message: "Survey not found" } }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");

    const [responses, total] = await Promise.all([
      prisma.surveyResponse.findMany({
        where: { surveyId: id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.surveyResponse.count({ where: { surveyId: id } }),
    ]);

    return NextResponse.json({
      success: true,
      data: responses.map((r) => ({
        id: r.id,
        respondentName: r.respondentName,
        respondentEmail: r.respondentEmail,
        respondentPhone: r.respondentPhone,
        answers: JSON.parse(r.answers || "{}"),
        rating: r.rating,
        createdAt: r.createdAt.toISOString(),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List survey responses error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch responses" } }, { status: 500 });
  }
}
