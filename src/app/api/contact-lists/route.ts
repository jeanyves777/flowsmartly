import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/contact-lists - Get user's contact lists
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
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {
      userId: session.userId,
    };

    if (search) {
      where.name = { contains: search };
    }

    const lists = await prisma.contactList.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { contacts: true, campaigns: true },
        },
      },
    });

    const formattedLists = lists.map(list => ({
      id: list.id,
      name: list.name,
      totalCount: list.totalCount,
      activeCount: list.activeCount,
      contactCount: list._count.contacts,
      campaignCount: list._count.campaigns,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        lists: formattedLists,
      },
    });
  } catch (error) {
    console.error("Get contact lists error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch contact lists" } },
      { status: 500 }
    );
  }
}

// POST /api/contact-lists - Create a new contact list
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
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "List name is required" } },
        { status: 400 }
      );
    }

    const list = await prisma.contactList.create({
      data: {
        userId: session.userId,
        name,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        list: {
          id: list.id,
          name: list.name,
          totalCount: 0,
          activeCount: 0,
          createdAt: list.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Create contact list error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create contact list" } },
      { status: 500 }
    );
  }
}
