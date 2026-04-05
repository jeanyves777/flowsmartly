import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// GET /api/data-forms/public/[slug]/search?q=name
// Searches contacts in the form's linked contact list by first name
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

    // Fetch the form and verify it's a SMART_COLLECT type with a linked list
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

    if (!form || form.status !== "ACTIVE" || form.type !== "SMART_COLLECT" || !form.contactListId) {
      return NextResponse.json(
        { success: false, error: { message: "Form not found or not configured" } },
        { status: 404 }
      );
    }

    // Find contacts in this list matching the search query
    // Use raw query for case-insensitive search (works on both SQLite and PostgreSQL)
    const contacts = await prisma.contact.findMany({
      where: {
        userId: form.userId,
        status: "ACTIVE",
        firstName: { contains: q },
        lists: {
          some: { contactListId: form.contactListId },
        },
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
