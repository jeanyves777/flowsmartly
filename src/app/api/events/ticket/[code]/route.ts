import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getUserBrand } from "@/lib/brand/get-brand";

// GET /api/events/ticket/[code] — Public: Look up ticket by code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const registration = await prisma.eventRegistration.findUnique({
      where: { ticketCode: code.toUpperCase() },
      include: {
        event: {
          select: {
            id: true,
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
            ticketType: true,
            ticketPrice: true,
            ticketName: true,
            ticketStyle: true,
            slug: true,
            userId: true,
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json(
        { success: false, error: { message: "Ticket not found. Please check your ticket code." } },
        { status: 404 }
      );
    }

    if (registration.status === "cancelled") {
      return NextResponse.json(
        { success: false, error: { message: "This ticket has been cancelled." } },
        { status: 410 }
      );
    }

    // Get brand info
    const brand = await getUserBrand(registration.event.userId);

    return NextResponse.json({
      success: true,
      data: {
        ticket: {
          code: registration.ticketCode,
          name: registration.name,
          email: registration.email,
          status: registration.status,
          rsvpResponse: registration.rsvpResponse,
          createdAt: registration.createdAt.toISOString(),
        },
        event: {
          title: registration.event.title,
          description: registration.event.description,
          eventDate: registration.event.eventDate.toISOString(),
          endDate: registration.event.endDate?.toISOString() || null,
          timezone: registration.event.timezone,
          venueName: registration.event.venueName,
          venueAddress: registration.event.venueAddress,
          isOnline: registration.event.isOnline,
          onlineUrl: registration.event.onlineUrl,
          coverImageUrl: registration.event.coverImageUrl,
          ticketType: registration.event.ticketType,
          ticketPrice: registration.event.ticketPrice,
          ticketName: registration.event.ticketName,
          ticketStyle: registration.event.ticketStyle,
          slug: registration.event.slug,
        },
        brand: brand ? {
          name: brand.name,
          logo: brand.logo,
          iconLogo: brand.iconLogo,
          colors: brand.colors,
        } : null,
      },
    });
  } catch (error) {
    console.error("Ticket lookup error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to look up ticket" } },
      { status: 500 }
    );
  }
}
