import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { parsePagination, paginationMeta } from "@/lib/tools/pagination";

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
    const { page, limit, skip, take } = parsePagination(searchParams, { defaultLimit: 25, maxLimit: 100 });
    const search = searchParams.get("search")?.trim();

    const where: Record<string, unknown> = { surveyId: id };
    if (search) {
      where.OR = [
        { respondentName: { contains: search, mode: "insensitive" } },
        { respondentEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    const [responses, total] = await Promise.all([
      prisma.surveyResponse.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.surveyResponse.count({ where }),
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
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error("List survey responses error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch responses" } }, { status: 500 });
  }
}

// DELETE /api/surveys/[id]/responses — Bulk-delete selected responses
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    // Verify the survey belongs to the caller before touching any responses.
    const survey = await prisma.survey.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!survey) {
      return NextResponse.json({ success: false, error: { message: "Survey not found" } }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const ids: unknown = (body as { ids?: unknown }).ids;

    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "string")) {
      return NextResponse.json(
        { success: false, error: { message: "Provide a non-empty array of response ids to delete." } },
        { status: 400 }
      );
    }

    // Scope deleteMany to this survey so a caller can't delete another survey's responses.
    const { count: deleted } = await prisma.surveyResponse.deleteMany({
      where: { surveyId: id, id: { in: ids as string[] } },
    });

    // Recompute the real remaining count rather than blindly decrementing,
    // so responseCount stays accurate even if some ids didn't match.
    const remaining = await prisma.surveyResponse.count({ where: { surveyId: id } });
    await prisma.survey.update({
      where: { id },
      data: { responseCount: remaining },
    });

    return NextResponse.json({ success: true, data: { deleted } });
  } catch (error) {
    console.error("Delete survey responses error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete responses" } }, { status: 500 });
  }
}
