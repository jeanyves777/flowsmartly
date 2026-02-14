import { prisma } from "@/lib/db/client";
import { headers } from "next/headers";

// Audit log categories
export const AuditCategory = {
  AUTH: "AUTH",
  USER: "USER",
  POST: "POST",
  CAMPAIGN: "CAMPAIGN",
  ADMIN: "ADMIN",
  SYSTEM: "SYSTEM",
  API: "API",
  BILLING: "BILLING",
} as const;

// Audit log severity levels
export const AuditSeverity = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR",
  CRITICAL: "CRITICAL",
} as const;

// Common audit actions
export const AuditAction = {
  // Auth
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  LOGIN_FAILED: "LOGIN_FAILED",
  REGISTER: "REGISTER",
  PASSWORD_RESET: "PASSWORD_RESET",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  SESSION_CREATED: "SESSION_CREATED",
  SESSION_EXPIRED: "SESSION_EXPIRED",

  // CRUD
  CREATE: "CREATE",
  READ: "READ",
  UPDATE: "UPDATE",
  DELETE: "DELETE",

  // Admin
  ADMIN_LOGIN: "ADMIN_LOGIN",
  ADMIN_ACTION: "ADMIN_ACTION",
  USER_BANNED: "USER_BANNED",
  USER_UNBANNED: "USER_UNBANNED",
  SETTINGS_CHANGED: "SETTINGS_CHANGED",

  // API
  API_REQUEST: "API_REQUEST",
  API_ERROR: "API_ERROR",

  // Billing
  SUBSCRIPTION_CREATED: "SUBSCRIPTION_CREATED",
  SUBSCRIPTION_CANCELLED: "SUBSCRIPTION_CANCELLED",
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
  PAYMENT_FAILED: "PAYMENT_FAILED",
} as const;

export interface AuditLogData {
  userId?: string | null;
  sessionId?: string | null;
  action: string;
  category?: string;
  severity?: string;
  resourceType?: string;
  resourceId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
  oldValue?: unknown;
  newValue?: unknown;
  errorMessage?: string;
}

interface GeoData {
  country?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
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
 * Parse User-Agent string to extract device info
 */
function parseUserAgent(userAgent: string): DeviceData {
  const data: DeviceData = {};

  // Browser detection
  if (userAgent.includes("Firefox")) {
    data.browser = "Firefox";
    const match = userAgent.match(/Firefox\/(\d+)/);
    if (match) data.browserVersion = match[1];
  } else if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
    data.browser = "Chrome";
    const match = userAgent.match(/Chrome\/(\d+)/);
    if (match) data.browserVersion = match[1];
  } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    data.browser = "Safari";
    const match = userAgent.match(/Version\/(\d+)/);
    if (match) data.browserVersion = match[1];
  } else if (userAgent.includes("Edg")) {
    data.browser = "Edge";
    const match = userAgent.match(/Edg\/(\d+)/);
    if (match) data.browserVersion = match[1];
  }

  // OS detection
  if (userAgent.includes("Windows")) {
    data.os = "Windows";
    if (userAgent.includes("Windows NT 10")) data.osVersion = "10";
    else if (userAgent.includes("Windows NT 11")) data.osVersion = "11";
  } else if (userAgent.includes("Mac OS")) {
    data.os = "macOS";
    const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    if (match) data.osVersion = match[1].replace("_", ".");
  } else if (userAgent.includes("Linux")) {
    data.os = "Linux";
  } else if (userAgent.includes("Android")) {
    data.os = "Android";
    const match = userAgent.match(/Android (\d+)/);
    if (match) data.osVersion = match[1];
  } else if (userAgent.includes("iOS") || userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    data.os = "iOS";
    const match = userAgent.match(/OS (\d+)/);
    if (match) data.osVersion = match[1];
  }

  // Device type detection
  if (userAgent.includes("Mobile") || userAgent.includes("Android") || userAgent.includes("iPhone")) {
    data.deviceType = "mobile";
    data.device = userAgent.includes("iPhone") ? "iPhone" : userAgent.includes("Android") ? "Android Phone" : "Mobile";
  } else if (userAgent.includes("iPad") || userAgent.includes("Tablet")) {
    data.deviceType = "tablet";
    data.device = userAgent.includes("iPad") ? "iPad" : "Tablet";
  } else {
    data.deviceType = "desktop";
    data.device = "Desktop";
  }

  return data;
}

/**
 * Get client IP address from request headers
 */
async function getClientIp(): Promise<string | null> {
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
 * Get geolocation data from IP (placeholder - integrate with IP geolocation service)
 */
async function getGeoData(ip: string | null): Promise<GeoData> {
  if (!ip || ip === "127.0.0.1" || ip === "::1") {
    return { country: "Local", city: "Local" };
  }

  // TODO: Integrate with IP geolocation service like MaxMind, IP-API, etc.
  // For now, return placeholder data
  return {
    country: "Unknown",
    city: "Unknown",
  };
}

/**
 * Main audit logging function
 */
export async function auditLog(data: AuditLogData): Promise<void> {
  try {
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "";
    const ipAddress = await getClientIp();
    const geoData = await getGeoData(ipAddress);
    const deviceData = parseUserAgent(userAgent);

    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        action: data.action,
        category: data.category || AuditCategory.SYSTEM,
        severity: data.severity || AuditSeverity.INFO,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        method: data.method,
        path: data.path,
        statusCode: data.statusCode,
        duration: data.duration,
        ipAddress,
        country: geoData.country,
        city: geoData.city,
        region: geoData.region,
        latitude: geoData.latitude,
        longitude: geoData.longitude,
        userAgent,
        browser: deviceData.browser,
        browserVersion: deviceData.browserVersion,
        os: deviceData.os,
        osVersion: deviceData.osVersion,
        device: deviceData.device,
        deviceType: deviceData.deviceType,
        metadata: data.metadata ? JSON.stringify(data.metadata) : "{}",
        oldValue: data.oldValue ? JSON.stringify(data.oldValue) : null,
        newValue: data.newValue ? JSON.stringify(data.newValue) : null,
        errorMessage: data.errorMessage,
      },
    });
  } catch (error) {
    // Don't throw - audit logging should never break the main flow
    console.error("Audit log error:", error);
  }
}

/**
 * Log authentication events
 */
export async function auditAuth(
  action: string,
  userId: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  const severity =
    action === AuditAction.LOGIN_FAILED ? AuditSeverity.WARNING : AuditSeverity.INFO;

  await auditLog({
    userId,
    action,
    category: AuditCategory.AUTH,
    severity,
    metadata,
  });
}

/**
 * Log admin actions
 */
export async function auditAdmin(
  action: string,
  adminId: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await auditLog({
    userId: adminId,
    action,
    category: AuditCategory.ADMIN,
    severity: AuditSeverity.INFO,
    resourceType,
    resourceId,
    metadata,
  });
}

/**
 * Log API requests
 */
export async function auditApi(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  userId?: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  const severity = statusCode >= 500 ? AuditSeverity.ERROR :
                   statusCode >= 400 ? AuditSeverity.WARNING :
                   AuditSeverity.DEBUG;

  await auditLog({
    userId,
    action: AuditAction.API_REQUEST,
    category: AuditCategory.API,
    severity,
    method,
    path,
    statusCode,
    duration,
    metadata,
  });
}
