import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/follow-ups/[id]/entries — List entries for a follow-up
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

    // Verify ownership
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const status = searchParams.get("status");
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = { followUpId: id };

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    const [entries, total] = await Promise.all([
      prisma.followUpEntry.findMany({
        where,
        orderBy: [
          { nextFollowUp: "asc" },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              imageUrl: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.followUpEntry.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: entries.map((e) => ({
        ...e,
        customData: JSON.parse(e.customData || "{}"),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List entries error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch entries" } },
      { status: 500 }
    );
  }
}

// POST /api/follow-ups/[id]/entries — Create new entry
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
    const { contactId, assigneeId, name, phone, email, address, referralSource, notes, status, nextFollowUp } = body;

    // Need at least a name, email, or phone
    if (!contactId && !name && !email && !phone) {
      return NextResponse.json(
        { success: false, error: { message: "At least a name, email, or phone is required" } },
        { status: 400 }
      );
    }

    // Verify contact ownership if provided
    if (contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, userId: session.userId },
      });
      if (!contact) {
        return NextResponse.json(
          { success: false, error: { message: "Contact not found" } },
          { status: 404 }
        );
      }
    }

    const entry = await prisma.followUpEntry.create({
      data: {
        followUpId: id,
        contactId: contactId || null,
        assigneeId: assigneeId || null,
        name: name?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        referralSource: referralSource?.trim() || null,
        notes: notes?.trim() || null,
        status: status || "PENDING",
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null,
      },
    });

    // Update counter
    await prisma.followUp.update({
      where: { id },
      data: { totalEntries: { increment: 1 } },
    });

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error("Create entry error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create entry" } },
      { status: 500 }
    );
  }
}
