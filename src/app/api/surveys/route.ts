import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 10; i++) slug += chars[Math.floor(Math.random() * chars.length)];
  return slug;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = { userId: session.userId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [surveys, total] = await Promise.all([
      prisma.survey.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { contactList: { select: { id: true, name: true } } },
      }),
      prisma.survey.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: surveys.map((s) => ({
        ...s,
        questions: JSON.parse(s.questions || "[]"),
        contactListName: s.contactList?.name || null,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List surveys error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch surveys" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const body = await request.json();
    const { title, description, questions, contactListId, thankYouMessage } = body;

    if (!title?.trim()) {
      return NextResponse.json({ success: false, error: { message: "Title is required" } }, { status: 400 });
    }

    if (contactListId) {
      const list = await prisma.contactList.findFirst({ where: { id: contactListId, userId: session.userId } });
      if (!list) return NextResponse.json({ success: false, error: { message: "Contact list not found" } }, { status: 404 });
    }

    let slug = generateSlug();
    while (await prisma.survey.findUnique({ where: { slug } })) {
      slug = generateSlug();
    }

    const hasQuestions = questions && Array.isArray(questions) && questions.length > 0;

    const survey = await prisma.survey.create({
      data: {
        userId: session.userId,
        title: title.trim(),
        description: description?.trim() || null,
        questions: hasQuestions ? JSON.stringify(questions) : "[]",
        slug,
        isActive: hasQuestions,
        status: hasQuestions ? "ACTIVE" : "DRAFT",
        contactListId: contactListId || null,
        thankYouMessage: thankYouMessage?.trim() || "Thank you for your response!",
      },
    });

    return NextResponse.json({
      success: true,
      data: { ...survey, questions: JSON.parse(survey.questions || "[]") },
    });
  } catch (error) {
    console.error("Create survey error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to create survey" } }, { status: 500 });
  }
}
