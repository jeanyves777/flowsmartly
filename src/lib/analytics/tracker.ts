import { prisma } from "@/lib/db/client";
import { headers } from "next/headers";
import { nanoid } from "nanoid";

// Cookie names
export const VISITOR_COOKIE = "fs_vid";
export const SESSION_COOKIE = "fs_sid";

interface GeoData {
  country?: string;
  countryCode?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
}

interface DeviceData {
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  device?: string;
  deviceType?: string;
}

/**
 * Parse User-Agent string
 */
export function parseUserAgent(userAgent: string): DeviceData {
  const data: DeviceData = {};

  // Browser detection
  if (userAgent.includes("Firefox")) {
    data.browser = "Firefox";
    const match = userAgent.match(/Firefox\/(\d+[\d.]*)/);
    if (match) data.browserVersion = match[1];
  } else if (userAgent.includes("Edg")) {
    data.browser = "Edge";
    const match = userAgent.match(/Edg\/(\d+[\d.]*)/);
    if (match) data.browserVersion = match[1];
  } else if (userAgent.includes("Chrome")) {
    data.browser = "Chrome";
    const match = userAgent.match(/Chrome\/(\d+[\d.]*)/);
    if (match) data.browserVersion = match[1];
  } else if (userAgent.includes("Safari")) {
    data.browser = "Safari";
    const match = userAgent.match(/Version\/(\d+[\d.]*)/);
    if (match) data.browserVersion = match[1];
  } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
    data.browser = "Opera";
  }

  // OS detection
  if (userAgent.includes("Windows NT 10")) {
    data.os = "Windows";
    data.osVersion = "10";
  } else if (userAgent.includes("Windows NT 11") || (userAgent.includes("Windows NT 10") && userAgent.includes("Win64"))) {
    data.os = "Windows";
    data.osVersion = "11";
  } else if (userAgent.includes("Mac OS X")) {
    data.os = "macOS";
    const match = userAgent.match(/Mac OS X (\d+[._]\d+[._]?\d*)/);
    if (match) data.osVersion = match[1].replace(/_/g, ".");
  } else if (userAgent.includes("Android")) {
    data.os = "Android";
    const match = userAgent.match(/Android (\d+[\d.]*)/);
    if (match) data.osVersion = match[1];
  } else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    data.os = "iOS";
    const match = userAgent.match(/OS (\d+[_\d]*)/);
    if (match) data.osVersion = match[1].replace(/_/g, ".");
  } else if (userAgent.includes("Linux")) {
    data.os = "Linux";
  }

  // Device type
  if (userAgent.includes("Mobile") || userAgent.includes("Android") && !userAgent.includes("Tablet")) {
    data.deviceType = "mobile";
    if (userAgent.includes("iPhone")) data.device = "iPhone";
    else if (userAgent.includes("Android")) data.device = "Android Phone";
    else data.device = "Mobile";
  } else if (userAgent.includes("iPad") || userAgent.includes("Tablet")) {
    data.deviceType = "tablet";
    if (userAgent.includes("iPad")) data.device = "iPad";
    else data.device = "Tablet";
  } else {
    data.deviceType = "desktop";
    data.device = "Desktop";
  }

  return data;
}

/**
 * Get client IP from request
 */
export async function getClientIp(): Promise<string | null> {
  try {
    const headersList = await headers();
    return (
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      headersList.get("cf-connecting-ip") ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Get geolocation from IP (integrate with IP geolocation service)
 */
export async function getGeoFromIp(ip: string | null): Promise<GeoData> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.")) {
    return { country: "Local", city: "Localhost" };
  }

  // TODO: Integrate with IP geolocation API (MaxMind, ip-api.com, etc.)
  // For production, use a service like:
  // - MaxMind GeoIP2
  // - ip-api.com (free tier available)
  // - ipinfo.io

  try {
    // Example with ip-api.com (free, no API key needed for limited use)
    // Uncomment for production:
    // const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,city,zip,lat,lon,timezone,isp`);
    // const data = await response.json();
    // if (data.status === "success") {
    //   return {
    //     country: data.country,
    //     countryCode: data.countryCode,
    //     city: data.city,
    //     region: data.region,
    //     postalCode: data.zip,
    //     latitude: data.lat,
    //     longitude: data.lon,
    //     timezone: data.timezone,
    //     isp: data.isp,
    //   };
    // }

    return { country: "Unknown" };
  } catch {
    return { country: "Unknown" };
  }
}

/**
 * Get or create visitor
 */
export async function getOrCreateVisitor(
  visitorId: string | null,
  sessionId: string | null,
  userId: string | null,
  clientData: {
    userAgent?: string;
    screenWidth?: number;
    screenHeight?: number;
    language?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }
): Promise<{ visitorId: string; sessionId: string; isNewVisitor: boolean; isNewSession: boolean }> {
  const ip = await getClientIp();
  const geo = await getGeoFromIp(ip);
  const device = parseUserAgent(clientData.userAgent || "");

  let isNewVisitor = false;
  let isNewSession = false;
  let visitor;

  // Try to find existing visitor
  if (visitorId) {
    visitor = await prisma.visitor.findUnique({
      where: { id: visitorId },
    });
  }

  // Create new visitor if not found
  if (!visitor) {
    isNewVisitor = true;
    visitor = await prisma.visitor.create({
      data: {
        userId,
        ipAddress: ip,
        country: geo.country,
        countryCode: geo.countryCode,
        city: geo.city,
        region: geo.region,
        postalCode: geo.postalCode,
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezone,
        isp: geo.isp,
        userAgent: clientData.userAgent,
        browser: device.browser,
        browserVersion: device.browserVersion,
        os: device.os,
        osVersion: device.osVersion,
        device: device.device,
        deviceType: device.deviceType,
        screenWidth: clientData.screenWidth,
        screenHeight: clientData.screenHeight,
        language: clientData.language,
        firstReferrer: clientData.referrer,
        firstUtmSource: clientData.utmSource,
        firstUtmMedium: clientData.utmMedium,
        firstUtmCampaign: clientData.utmCampaign,
      },
    });
  } else {
    // Update last seen
    await prisma.visitor.update({
      where: { id: visitor.id },
      data: {
        lastSeenAt: new Date(),
        totalVisits: { increment: 1 },
        userId: userId || visitor.userId,
      },
    });
  }

  // Handle session
  let finalSessionId = sessionId;
  if (!sessionId) {
    isNewSession = true;
    finalSessionId = nanoid();

    // Create new session record
    await prisma.visitorSession.create({
      data: {
        id: finalSessionId,
        visitorId: visitor.id,
        referrer: clientData.referrer,
        utmSource: clientData.utmSource,
        utmMedium: clientData.utmMedium,
        utmCampaign: clientData.utmCampaign,
        country: geo.country,
        city: geo.city,
        deviceType: device.deviceType,
        browser: device.browser,
        os: device.os,
      },
    });
  }

  return {
    visitorId: visitor.id,
    sessionId: finalSessionId!,
    isNewVisitor,
    isNewSession,
  };
}

/**
 * Track page view
 */
export async function trackPageView(data: {
  visitorId: string;
  sessionId: string;
  userId?: string | null;
  path: string;
  title?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  loadTime?: number;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  language?: string;
}): Promise<void> {
  const ip = await getClientIp();
  const geo = await getGeoFromIp(ip);
  const device = parseUserAgent(data.userAgent || "");

  await prisma.pageView.create({
    data: {
      visitorId: data.visitorId,
      sessionId: data.sessionId,
      userId: data.userId,
      path: data.path,
      title: data.title,
      referrer: data.referrer,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmTerm: data.utmTerm,
      utmContent: data.utmContent,
      loadTime: data.loadTime,
      ipAddress: ip,
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      region: geo.region,
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezone: geo.timezone,
      userAgent: data.userAgent,
      browser: device.browser,
      browserVersion: device.browserVersion,
      os: device.os,
      osVersion: device.osVersion,
      device: device.device,
      deviceType: device.deviceType,
      screenWidth: data.screenWidth,
      screenHeight: data.screenHeight,
      language: data.language,
    },
  });

  // Update visitor page view count
  await prisma.visitor.update({
    where: { id: data.visitorId },
    data: {
      totalPageViews: { increment: 1 },
      lastSeenAt: new Date(),
    },
  });

  // Update session
  await prisma.visitorSession.update({
    where: { id: data.sessionId },
    data: {
      pageViews: { increment: 1 },
      bounced: false,
      exitPage: data.path,
    },
  }).catch(() => {
    // Session might not exist yet
  });

  // Update realtime
  await prisma.realtimeVisitor.upsert({
    where: { id: `${data.visitorId}-${data.sessionId}` },
    create: {
      id: `${data.visitorId}-${data.sessionId}`,
      visitorId: data.visitorId,
      sessionId: data.sessionId,
      currentPath: data.path,
      country: geo.country,
      city: geo.city,
      deviceType: device.deviceType,
    },
    update: {
      currentPath: data.path,
      lastActiveAt: new Date(),
    },
  });
}

/**
 * Track custom event
 */
export async function trackEvent(data: {
  visitorId: string;
  sessionId?: string;
  userId?: string | null;
  eventName: string;
  eventCategory?: string;
  eventLabel?: string;
  eventValue?: number;
  path?: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  await prisma.trackingEvent.create({
    data: {
      visitorId: data.visitorId,
      sessionId: data.sessionId,
      userId: data.userId,
      eventName: data.eventName,
      eventCategory: data.eventCategory,
      eventLabel: data.eventLabel,
      eventValue: data.eventValue,
      path: data.path,
      properties: JSON.stringify(data.properties || {}),
    },
  });
}

/**
 * Update visitor contact info (from form submissions, etc.)
 */
export async function updateVisitorContact(
  visitorId: string,
  contactData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  }
): Promise<void> {
  const updateData: Record<string, string | number> = {};

  if (contactData.email) updateData.email = contactData.email;
  if (contactData.phone) updateData.phone = contactData.phone;
  if (contactData.firstName) updateData.firstName = contactData.firstName;
  if (contactData.lastName) updateData.lastName = contactData.lastName;
  if (contactData.company) updateData.company = contactData.company;

  // Increase lead score when contact info is provided
  if (contactData.email) updateData.leadScore = 10;
  if (contactData.phone) updateData.leadScore = 20;

  if (Object.keys(updateData).length > 0) {
    await prisma.visitor.update({
      where: { id: visitorId },
      data: updateData,
    });
  }
}
