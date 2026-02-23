import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getUserBrand } from "@/lib/brand/get-brand";

function generateTicketCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// GET /api/events/public/[slug] — Public: Get event by slug (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        userId: true,
        title: true,
        description: true,
        eventDate: true,
        endDate: true,
        timezone: true,
        venueName: true,
        venueAddress: true,
        isOnline: true,
        onlineUrl: true,
        coverImageUrl: true,
        mediaUrls: true,
        registrationType: true,
        registrationFields: true,
        capacity: true,
        registrationCount: true,
        ticketType: true,
        ticketPrice: true,
        ticketName: true,
        ticketStyle: true,
        settings: true,
        status: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: { message: "Event not found" } },
        { status: 404 }
      );
    }

    if (event.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: { message: "This event is no longer available" } },
        { status: 410 }
      );
    }

    // Fetch brand kit
    const brand = await getUserBrand(event.userId);

    const settings = JSON.parse(event.settings || "{}");

    return NextResponse.json({
      success: true,
      data: {
        title: event.title,
        description: event.description,
        eventDate: event.eventDate,
        endDate: event.endDate,
        timezone: event.timezone,
        venueName: event.venueName,
        venueAddress: event.venueAddress,
        isOnline: event.isOnline,
        onlineUrl: event.onlineUrl,
        coverImageUrl: event.coverImageUrl,
        mediaUrls: JSON.parse(event.mediaUrls || "[]"),
        registrationType: event.registrationType,
        registrationFields: JSON.parse(event.registrationFields || "[]"),
        capacity: event.capacity,
        registrationCount: event.registrationCount,
        ticketType: event.ticketType,
        ticketPrice: event.ticketPrice,
        ticketName: event.ticketName,
        settings,
        thankYouMessage: settings.thankYouMessage || null,
        brand,
      },
    });
  } catch (error) {
    console.error("Public get event error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load event" } },
      { status: 500 }
    );
  }
}

// POST /api/events/public/[slug] — Public: Register for event (no auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        userId: true,
        status: true,
        registrationType: true,
        registrationFields: true,
        capacity: true,
        registrationCount: true,
        ticketType: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: { message: "Event not found" } },
        { status: 404 }
      );
    }

    if (event.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: { message: "This event is no longer accepting registrations" } },
        { status: 410 }
      );
    }

    // Rate limiting: max 10 submissions per IP per hour
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               request.headers.get("x-real-ip") ||
               "unknown";
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentCount = await prisma.eventRegistration.count({
      where: {
        ipAddress: ip,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentCount >= 10) {
      return NextResponse.json(
        { success: false, error: { message: "Too many submissions. Please try again later." } },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, phone, rsvpResponse, formData } = body;

    // Validate based on registration type
    if (event.registrationType === "rsvp") {
      if (!name?.trim()) {
        return NextResponse.json({ success: false, error: { message: "Name is required" } }, { status: 400 });
      }
      if (!email?.trim()) {
        return NextResponse.json({ success: false, error: { message: "Email is required" } }, { status: 400 });
      }
      if (!rsvpResponse || !["attending", "not_attending", "maybe"].includes(rsvpResponse)) {
        return NextResponse.json({ success: false, error: { message: "RSVP response must be 'attending', 'not_attending', or 'maybe'" } }, { status: 400 });
      }
    } else if (event.registrationType === "form") {
      if (!name?.trim()) {
        return NextResponse.json({ success: false, error: { message: "Name is required" } }, { status: 400 });
      }
      if (!email?.trim()) {
        return NextResponse.json({ success: false, error: { message: "Email is required" } }, { status: 400 });
      }

      // Validate required fields from registrationFields
      const fields = JSON.parse(event.registrationFields || "[]");
      if (formData && typeof formData === "object") {
        for (const field of fields) {
          if (field.required && (!formData[field.id] || String(formData[field.id]).trim() === "")) {
            return NextResponse.json(
              { success: false, error: { message: `"${field.label}" is required` } },
              { status: 400 }
            );
          }
        }
      }
    } else if (event.registrationType === "booking") {
      // Paid bookings go through a separate purchase endpoint
      if (event.ticketType === "paid") {
        return NextResponse.json(
          { success: false, error: { message: "Please use the ticket purchase endpoint for paid events" } },
          { status: 400 }
        );
      }

      if (!name?.trim()) {
        return NextResponse.json({ success: false, error: { message: "Name is required" } }, { status: 400 });
      }
      if (!email?.trim()) {
        return NextResponse.json({ success: false, error: { message: "Email is required" } }, { status: 400 });
      }

      // Check capacity
      if (event.capacity && event.registrationCount >= event.capacity) {
        return NextResponse.json(
          { success: false, error: { message: "This event has reached its capacity" } },
          { status: 400 }
        );
      }
    }

    // Generate unique ticket code
    let ticketCode = generateTicketCode();
    while (await prisma.eventRegistration.findUnique({ where: { ticketCode } })) {
      ticketCode = generateTicketCode();
    }

    // Create registration
    const registration = await prisma.eventRegistration.create({
      data: {
        eventId: event.id,
        name: name?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        status: "registered",
        rsvpResponse: rsvpResponse || null,
        formData: formData ? JSON.stringify(formData) : "{}",
        ticketCode,
        ipAddress: ip,
        userAgent: request.headers.get("user-agent") || null,
      },
    });

    // Increment registration count
    await prisma.event.update({
      where: { id: event.id },
      data: { registrationCount: { increment: 1 } },
    });

    // Auto-create contact if email provided
    if (email?.trim()) {
      const trimmedEmail = email.trim();
      const existingContact = await prisma.contact.findFirst({
        where: { userId: event.userId, email: trimmedEmail },
      });

      if (!existingContact) {
        // Parse name into first/last
        const nameParts = (name?.trim() || "").split(" ");
        const firstName = nameParts[0] || null;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

        await prisma.contact.create({
          data: {
            userId: event.userId,
            email: trimmedEmail,
            phone: phone?.trim() || null,
            firstName,
            lastName,
            emailOptedIn: true,
            emailOptedInAt: new Date(),
            status: "ACTIVE",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { ticketCode: registration.ticketCode, message: "Registration successful" },
    });
  } catch (error) {
    console.error("Event registration error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to register for event" } },
      { status: 500 }
    );
  }
}
