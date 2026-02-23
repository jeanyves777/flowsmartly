import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/events/[id]/registrations — List event registrations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const event = await prisma.event.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json({ success: false, error: { message: "Event not found" } }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = { eventId: id };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [registrations, total] = await Promise.all([
      prisma.eventRegistration.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.eventRegistration.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: registrations.map((r) => ({
        id: r.id,
        eventId: r.eventId,
        contactId: r.contactId,
        name: r.name,
        email: r.email,
        phone: r.phone,
        status: r.status,
        rsvpResponse: r.rsvpResponse,
        formData: JSON.parse(r.formData || "{}"),
        ticketCode: r.ticketCode,
        ticketOrderId: r.ticketOrderId,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt.toISOString(),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List event registrations error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch registrations" } }, { status: 500 });
  }
}

// DELETE /api/events/[id]/registrations — Bulk delete registrations
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const event = await prisma.event.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json({ success: false, error: { message: "Event not found" } }, { status: 404 });
    }

    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: { message: "ids array is required" } }, { status: 400 });
    }

    const result = await prisma.eventRegistration.deleteMany({
      where: { id: { in: ids }, eventId: id },
    });

    // Decrement registration count by the number actually deleted
    if (result.count > 0) {
      await prisma.event.update({
        where: { id },
        data: { registrationCount: { decrement: result.count } },
      });
    }

    return NextResponse.json({
      success: true,
      data: { message: `Deleted ${result.count} registration(s)`, deleted: result.count },
    });
  } catch (error) {
    console.error("Bulk delete registrations error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete registrations" } }, { status: 500 });
  }
}
