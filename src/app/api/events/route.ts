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

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          contactList: { select: { id: true, name: true } },
          _count: { select: { registrations: true, ticketOrders: true } },
        },
      }),
      prisma.event.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: events.map((e) => ({
        ...e,
        mediaUrls: JSON.parse(e.mediaUrls || "[]"),
        registrationFields: JSON.parse(e.registrationFields || "[]"),
        settings: JSON.parse(e.settings || "{}"),
        contactListName: e.contactList?.name || null,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List events error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch events" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

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

    if (!title?.trim()) {
      return NextResponse.json({ success: false, error: { message: "Title is required" } }, { status: 400 });
    }

    if (!eventDate) {
      return NextResponse.json({ success: false, error: { message: "Event date is required" } }, { status: 400 });
    }

    if (contactListId) {
      const list = await prisma.contactList.findFirst({ where: { id: contactListId, userId: session.userId } });
      if (!list) return NextResponse.json({ success: false, error: { message: "Contact list not found" } }, { status: 404 });
    }

    let slug = generateSlug();
    while (await prisma.event.findUnique({ where: { slug } })) {
      slug = generateSlug();
    }

    const event = await prisma.event.create({
      data: {
        userId: session.userId,
        title: title.trim(),
        description: description?.trim() || null,
        eventDate: new Date(eventDate),
        endDate: endDate ? new Date(endDate) : null,
        timezone: timezone || null,
        venueName: venueName?.trim() || null,
        venueAddress: venueAddress?.trim() || null,
        isOnline: isOnline || false,
        onlineUrl: onlineUrl?.trim() || null,
        coverImageUrl: coverImageUrl?.trim() || null,
        mediaUrls: mediaUrls ? JSON.stringify(mediaUrls) : "[]",
        registrationType: registrationType || "rsvp",
        registrationFields: registrationFields ? JSON.stringify(registrationFields) : "[]",
        capacity: capacity || null,
        ticketType: ticketType || "free",
        ticketPrice: ticketPrice || null,
        ticketName: ticketName?.trim() || null,
        ticketStyle: ticketStyle || "classic",
        contactListId: contactListId || null,
        settings: settings ? JSON.stringify(settings) : "{}",
        status: status || "DRAFT",
        slug,
      },
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
    console.error("Create event error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to create event" } }, { status: 500 });
  }
}
