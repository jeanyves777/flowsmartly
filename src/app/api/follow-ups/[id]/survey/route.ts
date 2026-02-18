import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 10; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}

// GET /api/follow-ups/[id]/survey — Get survey for a follow-up
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

    const followUp = await prisma.followUp.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!followUp) {
      return NextResponse.json(
        { success: false, error: { message: "Follow-up not found" } },
        { status: 404 }
      );
    }

    const survey = await prisma.followUpSurvey.findUnique({
      where: { followUpId: id },
    });

    if (!survey) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...survey,
        questions: JSON.parse(survey.questions || "[]"),
      },
    });
  } catch (error) {
    console.error("Get survey error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch survey" } },
      { status: 500 }
    );
  }
}

// POST /api/follow-ups/[id]/survey — Create or update survey (upsert)
export async function POST(
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

    const followUp = await prisma.followUp.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!followUp) {
      return NextResponse.json(
        { success: false, error: { message: "Follow-up not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, description, questions, slug, isActive, thankYouMessage } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Survey title is required" } },
        { status: 400 }
      );
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "At least one question is required" } },
        { status: 400 }
      );
    }

    // Validate questions structure
    for (const q of questions) {
      if (!q.id || !q.type || !q.label?.trim()) {
        return NextResponse.json(
          { success: false, error: { message: "Each question must have an id, type, and label" } },
          { status: 400 }
        );
      }
    }

    // Check if survey already exists
    const existing = await prisma.followUpSurvey.findUnique({
      where: { followUpId: id },
    });

    let surveySlug = slug;
    if (!surveySlug) {
      if (existing) {
        surveySlug = existing.slug;
      } else {
        // Generate unique slug
        let attempts = 0;
        do {
          surveySlug = generateSlug();
          const dup = await prisma.followUpSurvey.findUnique({ where: { slug: surveySlug } });
          if (!dup) break;
          attempts++;
        } while (attempts < 10);
      }
    } else {
      // Validate slug uniqueness (but allow keeping the same slug)
      const dup = await prisma.followUpSurvey.findFirst({
        where: { slug: surveySlug, NOT: { followUpId: id } },
      });
      if (dup) {
        return NextResponse.json(
          { success: false, error: { message: "This survey URL is already taken" } },
          { status: 400 }
        );
      }
    }

    const data = {
      title: title.trim(),
      description: description?.trim() || null,
      questions: JSON.stringify(questions),
      slug: surveySlug,
      isActive: isActive !== undefined ? isActive : true,
      thankYouMessage: thankYouMessage?.trim() || "Thank you for your response!",
    };

    const survey = existing
      ? await prisma.followUpSurvey.update({
          where: { followUpId: id },
          data,
        })
      : await prisma.followUpSurvey.create({
          data: { ...data, followUpId: id },
        });

    return NextResponse.json({
      success: true,
      data: {
        ...survey,
        questions: JSON.parse(survey.questions || "[]"),
      },
    });
  } catch (error) {
    console.error("Save survey error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to save survey" } },
      { status: 500 }
    );
  }
}
