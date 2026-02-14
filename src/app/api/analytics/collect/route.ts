import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getOrCreateVisitor,
  trackPageView,
  trackEvent,
  updateVisitorContact,
  VISITOR_COOKIE,
  SESSION_COOKIE,
} from "@/lib/analytics/tracker";
import { cookies } from "next/headers";

// Validation schemas
const pageViewSchema = z.object({
  type: z.literal("pageview"),
  path: z.string(),
  title: z.string().optional(),
  referrer: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
  loadTime: z.number().optional(),
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
  language: z.string().optional(),
});

const eventSchema = z.object({
  type: z.literal("event"),
  eventName: z.string(),
  eventCategory: z.string().optional(),
  eventLabel: z.string().optional(),
  eventValue: z.number().optional(),
  path: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
});

const identifySchema = z.object({
  type: z.literal("identify"),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
});

const collectSchema = z.discriminatedUnion("type", [
  pageViewSchema,
  eventSchema,
  identifySchema,
]);

// Cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 365 * 24 * 60 * 60, // 1 year
};

const SESSION_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 30 * 60, // 30 minutes
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = collectSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid data" },
        { status: 400 }
      );
    }

    const data = validation.data;
    const cookieStore = await cookies();
    const userAgent = request.headers.get("user-agent") || "";

    // Get existing visitor/session IDs from cookies
    let visitorId = cookieStore.get(VISITOR_COOKIE)?.value || null;
    let sessionId = cookieStore.get(SESSION_COOKIE)?.value || null;

    // Extract UTM params from first pageview
    const utmData = data.type === "pageview" ? {
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      referrer: data.referrer,
    } : {};

    // Get or create visitor
    const visitor = await getOrCreateVisitor(
      visitorId,
      sessionId,
      null, // userId - would come from auth session
      {
        userAgent,
        screenWidth: data.type === "pageview" ? data.screenWidth : undefined,
        screenHeight: data.type === "pageview" ? data.screenHeight : undefined,
        language: data.type === "pageview" ? data.language : undefined,
        ...utmData,
      }
    );

    visitorId = visitor.visitorId;
    sessionId = visitor.sessionId;

    // Process based on type
    switch (data.type) {
      case "pageview":
        await trackPageView({
          visitorId,
          sessionId,
          path: data.path,
          title: data.title,
          referrer: data.referrer,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          utmCampaign: data.utmCampaign,
          utmTerm: data.utmTerm,
          utmContent: data.utmContent,
          loadTime: data.loadTime,
          userAgent,
          screenWidth: data.screenWidth,
          screenHeight: data.screenHeight,
          language: data.language,
        });
        break;

      case "event":
        await trackEvent({
          visitorId,
          sessionId,
          eventName: data.eventName,
          eventCategory: data.eventCategory,
          eventLabel: data.eventLabel,
          eventValue: data.eventValue,
          path: data.path,
          properties: data.properties,
        });
        break;

      case "identify":
        await updateVisitorContact(visitorId, {
          email: data.email,
          phone: data.phone,
          firstName: data.firstName,
          lastName: data.lastName,
          company: data.company,
        });
        break;
    }

    // Create response with cookies
    const response = NextResponse.json({ success: true });

    // Set/refresh cookies
    if (visitor.isNewVisitor) {
      response.cookies.set(VISITOR_COOKIE, visitorId, COOKIE_OPTIONS);
    }

    if (visitor.isNewSession) {
      response.cookies.set(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS);
    } else {
      // Refresh session cookie
      response.cookies.set(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS);
    }

    return response;
  } catch (error) {
    console.error("Analytics collect error:", error);
    return NextResponse.json(
      { success: false, error: "Collection failed" },
      { status: 500 }
    );
  }
}

// Allow CORS for the tracking pixel
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
