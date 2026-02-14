import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/contact-lists/[listId] - Get list details + paginated contacts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const list = await prisma.contactList.findFirst({
      where: { id: listId, userId: session.userId },
    });

    if (!list) {
      return NextResponse.json(
        { success: false, error: { message: "Contact list not found" } },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "25", 10)));
    const search = searchParams.get("search") || "";

    const memberWhere: Record<string, unknown> = {
      contactListId: listId,
    };

    if (search) {
      memberWhere.contact = {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
        ],
      };
    }

    const [members, total] = await Promise.all([
      prisma.contactListMember.findMany({
        where: memberWhere,
        include: {
          contact: true,
        },
        orderBy: { addedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contactListMember.count({ where: memberWhere }),
    ]);

    const contacts = members.map((m) => ({
      id: m.contact.id,
      email: m.contact.email,
      phone: m.contact.phone,
      firstName: m.contact.firstName,
      lastName: m.contact.lastName,
      company: m.contact.company,
      status: m.contact.status,
      addedAt: m.addedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        list: {
          id: list.id,
          name: list.name,
          totalCount: list.totalCount,
          activeCount: list.activeCount,
          createdAt: list.createdAt.toISOString(),
        },
        contacts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get contact list error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch contact list" } },
      { status: 500 }
    );
  }
}

// PATCH /api/contact-lists/[listId] - Rename list
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const list = await prisma.contactList.findFirst({
      where: { id: listId, userId: session.userId },
    });

    if (!list) {
      return NextResponse.json(
        { success: false, error: { message: "Contact list not found" } },
        { status: 404 }
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

    const updatedList = await prisma.contactList.update({
      where: { id: listId },
      data: { name },
    });

    return NextResponse.json({
      success: true,
      data: {
        list: {
          id: updatedList.id,
          name: updatedList.name,
          totalCount: updatedList.totalCount,
          activeCount: updatedList.activeCount,
          createdAt: updatedList.createdAt.toISOString(),
          updatedAt: updatedList.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Update contact list error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update contact list" } },
      { status: 500 }
    );
  }
}

// DELETE /api/contact-lists/[listId] - Delete list (cascade removes members, not contacts)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const list = await prisma.contactList.findFirst({
      where: { id: listId, userId: session.userId },
    });

    if (!list) {
      return NextResponse.json(
        { success: false, error: { message: "Contact list not found" } },
        { status: 404 }
      );
    }

    await prisma.contactList.delete({
      where: { id: listId },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Contact list deleted successfully" },
    });
  } catch (error) {
    console.error("Delete contact list error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete contact list" } },
      { status: 500 }
    );
  }
}
