import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/events/[id] — Get event details
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
      include: {
        contactList: { select: { id: true, name: true } },
        _count: { select: { registrations: true, ticketOrders: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ success: false, error: { message: "Event not found" } }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...event,
        mediaUrls: JSON.parse(event.mediaUrls || "[]"),
        registrationFields: JSON.parse(event.registrationFields || "[]"),
        settings: JSON.parse(event.settings || "{}"),
        contactListName: event.contactList?.name || null,
      },
    });
  } catch (error) {
    console.error("Get event error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch event" } }, { status: 500 });
  }
}

// PUT /api/events/[id] — Update event
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const existing = await prisma.event.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Event not found" } }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      description,
      eventDate,
      endDate,
      timezone,
      venueName,
      venueAddress,
      isOnline,
      onlineUrl,
      coverImageUrl,
      mediaUrls,
      registrationType,
      registrationFields,
      capacity,
      ticketType,
      ticketPrice,
      ticketName,
      ticketStyle,
      contactListId,
      settings,
      status,
    } = body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (eventDate !== undefined) data.eventDate = new Date(eventDate);
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (timezone !== undefined) data.timezone = timezone || null;
    if (venueName !== undefined) data.venueName = venueName?.trim() || null;
    if (venueAddress !== undefined) data.venueAddress = venueAddress?.trim() || null;
    if (isOnline !== undefined) data.isOnline = isOnline;
    if (onlineUrl !== undefined) data.onlineUrl = onlineUrl?.trim() || null;
    if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl?.trim() || null;
    if (mediaUrls !== undefined) data.mediaUrls = JSON.stringify(mediaUrls);
    if (registrationType !== undefined) data.registrationType = registrationType;
    if (registrationFields !== undefined) data.registrationFields = JSON.stringify(registrationFields);
    if (capacity !== undefined) data.capacity = capacity;
    if (ticketType !== undefined) data.ticketType = ticketType;
    if (ticketPrice !== undefined) data.ticketPrice = ticketPrice;
    if (ticketName !== undefined) data.ticketName = ticketName?.trim() || null;
    if (ticketStyle !== undefined) data.ticketStyle = ticketStyle;
    if (contactListId !== undefined) data.contactListId = contactListId || null;
    if (settings !== undefined) data.settings = JSON.stringify(settings);
    if (status !== undefined) data.status = status;

    const event = await prisma.event.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...event,
        mediaUrls: JSON.parse(event.mediaUrls || "[]"),
        registrationFields: JSON.parse(event.registrationFields || "[]"),
        settings: JSON.parse(event.settings || "{}"),
      },
    });
  } catch (error) {
    console.error("Update event error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update event" } }, { status: 500 });
  }
}

// DELETE /api/events/[id] — Delete event, registrations, and ticket orders
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const existing = await prisma.event.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Event not found" } }, { status: 404 });
    }

    // Delete registrations first, then ticket orders, then event
    await prisma.eventRegistration.deleteMany({ where: { eventId: id } });
    await prisma.ticketOrder.deleteMany({ where: { eventId: id } });
    await prisma.event.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { message: "Event deleted" } });
  } catch (error) {
    console.error("Delete event error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete event" } }, { status: 500 });
  }
}
