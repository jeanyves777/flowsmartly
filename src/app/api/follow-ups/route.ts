import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/follow-ups — List follow-ups for authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type"); // TRACKER | SURVEY
    const status = searchParams.get("status");
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {
      userId: session.userId,
    };

    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [followUps, total] = await Promise.all([
      prisma.followUp.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          contactList: { select: { id: true, name: true } },
          survey: { select: { id: true, slug: true, responseCount: true } },
          _count: { select: { entries: true } },
        },
      }),
      prisma.followUp.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: followUps.map((f) => ({
        ...f,
        settings: JSON.parse(f.settings || "{}"),
        contactListName: f.contactList?.name || null,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List follow-ups error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch follow-ups" } },
      { status: 500 }
    );
  }
}

// POST /api/follow-ups — Create new follow-up
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, type, contactListId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Name is required" } },
        { status: 400 }
      );
    }

    if (type && !["TRACKER", "SURVEY"].includes(type)) {
      return NextResponse.json(
        { success: false, error: { message: "Type must be TRACKER or SURVEY" } },
        { status: 400 }
      );
    }

    // Verify contact list ownership if provided
    if (contactListId) {
      const list = await prisma.contactList.findFirst({
        where: { id: contactListId, userId: session.userId },
      });
      if (!list) {
        return NextResponse.json(
          { success: false, error: { message: "Contact list not found" } },
          { status: 404 }
        );
      }
    }

    const followUp = await prisma.followUp.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        description: description?.trim() || null,
        type: type || "TRACKER",
        contactListId: contactListId || null,
      },
    });

    // Auto-import contacts from linked list if requested
    let importedCount = 0;
    if (contactListId && body.autoImport) {
      const members = await prisma.contactListMember.findMany({
        where: { contactListId },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              address: true,
            },
          },
        },
      });

      if (members.length > 0) {
        await prisma.followUpEntry.createMany({
          data: members.map((m) => ({
            followUpId: followUp.id,
            contactId: m.contact.id,
            name: [m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || null,
            phone: m.contact.phone,
            email: m.contact.email,
            address: m.contact.address,
          })),
        });

        importedCount = members.length;
        await prisma.followUp.update({
          where: { id: followUp.id },
          data: { totalEntries: importedCount },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...followUp, totalEntries: importedCount },
    });
  } catch (error) {
    console.error("Create follow-up error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create follow-up" } },
      { status: 500 }
    );
  }
}
