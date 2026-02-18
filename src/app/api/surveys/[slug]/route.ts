import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// GET /api/surveys/[slug] — Public: Get survey by slug (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const survey = await prisma.followUpSurvey.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        description: true,
        questions: true,
        isActive: true,
        thankYouMessage: true,
      },
    });

    if (!survey) {
      return NextResponse.json(
        { success: false, error: { message: "Survey not found" } },
        { status: 404 }
      );
    }

    if (!survey.isActive) {
      return NextResponse.json(
        { success: false, error: { message: "This survey is no longer accepting responses" } },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        title: survey.title,
        description: survey.description,
        questions: JSON.parse(survey.questions || "[]"),
        thankYouMessage: survey.thankYouMessage,
      },
    });
  } catch (error) {
    console.error("Public get survey error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load survey" } },
      { status: 500 }
    );
  }
}

// POST /api/surveys/[slug] — Public: Submit survey response (no auth required)
export async function POST(request: NextRequest) {
  try {
    // Extract slug from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const slug = pathParts[pathParts.length - 1];

    const survey = await prisma.followUpSurvey.findUnique({
      where: { slug },
      select: {
        id: true,
        isActive: true,
        questions: true,
      },
    });

    if (!survey) {
      return NextResponse.json(
        { success: false, error: { message: "Survey not found" } },
        { status: 404 }
      );
    }

    if (!survey.isActive) {
      return NextResponse.json(
        { success: false, error: { message: "This survey is no longer accepting responses" } },
        { status: 410 }
      );
    }

    const body = await request.json();
    const { answers, respondentName, respondentEmail, respondentPhone } = body;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { success: false, error: { message: "Answers are required" } },
        { status: 400 }
      );
    }

    // Validate required questions
    const questions = JSON.parse(survey.questions || "[]");
    for (const q of questions) {
      if (q.required && (!answers[q.id] || String(answers[q.id]).trim() === "")) {
        return NextResponse.json(
          { success: false, error: { message: `"${q.label}" is required` } },
          { status: 400 }
        );
      }
    }

    // Rate limiting: max 5 submissions per IP per survey per hour
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               request.headers.get("x-real-ip") ||
               "unknown";
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentCount = await prisma.surveyResponse.count({
      where: {
        surveyId: survey.id,
        ipAddress: ip,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentCount >= 5) {
      return NextResponse.json(
        { success: false, error: { message: "Too many submissions. Please try again later." } },
        { status: 429 }
      );
    }

    // Extract rating from a rating-type question
    let rating: number | null = null;
    for (const q of questions) {
      if (q.type === "rating" && answers[q.id]) {
        rating = parseInt(String(answers[q.id]), 10);
        if (isNaN(rating)) rating = null;
        break;
      }
    }

    // Create response
    const response = await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        respondentName: respondentName?.trim() || null,
        respondentEmail: respondentEmail?.trim() || null,
        respondentPhone: respondentPhone?.trim() || null,
        answers: JSON.stringify(answers),
        rating,
        ipAddress: ip,
        userAgent: request.headers.get("user-agent") || null,
      },
    });

    // Increment response count
    await prisma.followUpSurvey.update({
      where: { id: survey.id },
      data: { responseCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: { id: response.id },
    });
  } catch (error) {
    console.error("Submit survey response error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to submit response" } },
      { status: 500 }
    );
  }
}
