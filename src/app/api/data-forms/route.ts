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

    const [dataForms, total] = await Promise.all([
      prisma.dataForm.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dataForm.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: dataForms.map((form) => ({
        ...form,
        fields: JSON.parse(form.fields || "[]"),
        settings: JSON.parse(form.settings || "{}"),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List data forms error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch data forms" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const body = await request.json();
    const { title, description, fields, thankYouMessage, settings } = body;

    if (!title?.trim()) {
      return NextResponse.json({ success: false, error: { message: "Title is required" } }, { status: 400 });
    }

    let slug = generateSlug();
    while (await prisma.dataForm.findUnique({ where: { slug } })) {
      slug = generateSlug();
    }

    const hasFields = fields && Array.isArray(fields) && fields.length > 0;

    const dataForm = await prisma.dataForm.create({
      data: {
        userId: session.userId,
        title: title.trim(),
        description: description?.trim() || null,
        fields: hasFields ? JSON.stringify(fields) : "[]",
        slug,
        status: hasFields ? "ACTIVE" : "DRAFT",
        thankYouMessage: thankYouMessage?.trim() || "Thank you for your submission!",
        settings: settings ? JSON.stringify(settings) : "{}",
      },
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
    console.error("Create data form error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to create data form" } }, { status: 500 });
  }
}
