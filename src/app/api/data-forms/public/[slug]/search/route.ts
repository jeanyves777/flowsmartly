import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// GET /api/data-forms/public/[slug]/search?q=name
// Searches ALL contacts for this user by first name
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const q = request.nextUrl.searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const form = await prisma.dataForm.findUnique({
      where: { slug },
      select: {
        id: true,
        type: true,
        status: true,
        contactListId: true,
        userId: true,
      },
    });

    if (!form || form.status !== "ACTIVE" || !['SMART_COLLECT','ATTENDANCE'].includes(form.type)) {
      return NextResponse.json(
        { success: false, error: { message: "Form not found or not configured" } },
        { status: 404 }
      );
    }

    // Search ALL contacts for this user (case-insensitive)
    const contacts = await prisma.contact.findMany({
      where: {
        userId: form.userId,
        status: "ACTIVE",
        firstName: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthday: true,
      },
      take: 10,
    });

    const results = contacts.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      birthday: c.birthday,
    }));

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("Smart collect search error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Search failed" } },
      { status: 500 }
    );
  }
}
