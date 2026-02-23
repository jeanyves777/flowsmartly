import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { generateLandingPage } from "@/lib/landing-pages/generator";
import { getUserBrand } from "@/lib/brand/get-brand";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 10; i++) slug += chars[Math.floor(Math.random() * chars.length)];
  return slug;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const event = await prisma.event.findFirst({
      where: { id, userId: session.userId },
    });

    if (!event) {
      return NextResponse.json({ success: false, error: { message: "Event not found" } }, { status: 404 });
    }

    if (event.landingPageId) {
      return NextResponse.json({ success: false, error: { message: "Landing page already exists for this event" } }, { status: 400 });
    }

    // Check credits
    const creditCost = await getDynamicCreditCost("AI_LANDING_PAGE");
    const balance = await creditService.getBalance(session.userId);
    if (balance < creditCost) {
      return NextResponse.json({ success: false, error: { message: `Insufficient credits. Need ${creditCost}, have ${balance}.` } }, { status: 402 });
    }

    // Get brand info
    const brand = await getUserBrand(session.userId);

    const eventDate = new Date(event.eventDate);
    const dateStr = eventDate.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const timeStr = eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    const eventUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com"}/event/${event.slug}`;

    // Build prompt
    const prompt = [
      `Create an event landing page for: "${event.title}"`,
      event.description ? `Description: ${event.description}` : "",
      `Date: ${dateStr} at ${timeStr}`,
      event.venueName ? `Venue: ${event.venueName}` : "",
      event.venueAddress ? `Address: ${event.venueAddress}` : "",
      event.isOnline ? "This is an online event" : "",
      event.ticketType === "paid" && event.ticketPrice
        ? `Ticket price: $${(event.ticketPrice / 100).toFixed(2)}`
        : "Free event",
      `Registration link: ${eventUrl}`,
      `All CTA buttons should link to: ${eventUrl}`,
    ].filter(Boolean).join("\n");

    // Generate landing page
    const generated = await generateLandingPage({
      prompt,
      pageType: "event",
      brandName: brand?.name,
      colors: brand?.colors || undefined,
      imageUrl: event.coverImageUrl || undefined,
      logoUrl: brand?.logo || undefined,
      ctaUrl: eventUrl,
      ctaText: event.ticketType === "paid" ? "Get Tickets" : "Register Now",
    });

    // Generate unique slug
    let lpSlug = generateSlug();
    while (await prisma.landingPage.findUnique({ where: { slug: lpSlug } })) {
      lpSlug = generateSlug();
    }

    // Create landing page
    const landingPage = await prisma.landingPage.create({
      data: {
        userId: session.userId,
        title: generated.title || event.title,
        slug: lpSlug,
        description: generated.description || event.description || "",
        pageType: "event",
        prompt,
        htmlContent: generated.html,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    // Link to event
    await prisma.event.update({
      where: { id },
      data: { landingPageId: landingPage.id },
    });

    // Deduct credits
    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditCost,
      description: `Landing page for event: ${event.title}`,
      referenceType: "landing_page",
      referenceId: landingPage.id,
    });

    return NextResponse.json({
      success: true,
      data: { landingPage: { id: landingPage.id, slug: landingPage.slug } },
    });
  } catch (error) {
    console.error("Create event landing page error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to create landing page" } }, { status: 500 });
  }
}
