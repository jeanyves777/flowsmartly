import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import { auditAdmin, AuditAction } from "@/lib/audit/logger";

// Default settings
const DEFAULT_SETTINGS = {
  general: {
    siteName: "FlowSmartly",
    siteUrl: "https://flowsmartly.com",
    supportEmail: "support@flowsmartly.com",
    timezone: "America/New_York",
    maintenanceMode: false,
  },
  email: {
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    smtpSecure: true,
    fromEmail: "noreply@flowsmartly.com",
    fromName: "FlowSmartly",
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 30,
    sessionTimeout: 1440,
    requireMfa: false,
    passwordMinLength: 8,
  },
  api: {
    rateLimit: 100,
    rateLimitWindow: 60,
    enablePublicApi: true,
  },
  features: {
    enableRegistration: true,
    enableSocialAuth: true,
    enableAiStudio: true,
    enableCampaigns: true,
    enableAnalytics: true,
    enableBilling: true,
  },
  tracking: {
    enableTracking: true,
    trackingId: "FS-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
    enableFingerprinting: true,
    enableGeoLocation: true,
    retentionDays: 365,
  },
};

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Fetch all settings from database
    const dbSettings = await prisma.systemSetting.findMany();

    // Build settings object from database
    const settings = { ...DEFAULT_SETTINGS };

    dbSettings.forEach((setting) => {
      const parts = setting.key.split(".");
      if (parts.length === 2) {
        const [category, key] = parts;
        if (settings[category as keyof typeof settings]) {
          const categorySettings = settings[category as keyof typeof settings] as Record<string, unknown>;
          // Parse value based on type
          let value: unknown = setting.value;
          if (setting.type === "boolean") {
            value = setting.value === "true";
          } else if (setting.type === "number") {
            value = parseInt(setting.value, 10);
          } else if (setting.type === "json") {
            try {
              value = JSON.parse(setting.value);
            } catch {
              value = setting.value;
            }
          }
          categorySettings[key] = value;
        }
      }
    });

    // Get API keys
    const apiKeys = await prisma.systemSetting.findMany({
      where: { key: { startsWith: "api.key." } },
    });

    const formattedApiKeys = apiKeys.map((key) => {
      const data = JSON.parse(key.value);
      return {
        id: key.id,
        name: data.name,
        key: data.key,
        createdAt: data.createdAt,
        lastUsed: data.lastUsed,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        settings,
        apiKeys: formattedApiKeys,
      },
    });
  } catch (error) {
    console.error("Admin settings error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch settings" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { category, settings } = body;

    if (!category || !settings) {
      return NextResponse.json(
        { success: false, error: { message: "Missing category or settings" } },
        { status: 400 }
      );
    }

    // Get old values for audit
    const oldSettings = await prisma.systemSetting.findMany({
      where: { key: { startsWith: `${category}.` } },
    });

    const oldValues: Record<string, string> = {};
    oldSettings.forEach((s) => {
      oldValues[s.key] = s.value;
    });

    // Update settings
    const updates = Object.entries(settings).map(async ([key, value]) => {
      const fullKey = `${category}.${key}`;
      const type = typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "string";
      const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);

      return prisma.systemSetting.upsert({
        where: { key: fullKey },
        create: {
          key: fullKey,
          value: stringValue,
          type,
          category,
          updatedBy: session.adminId,
        },
        update: {
          value: stringValue,
          type,
          updatedBy: session.adminId,
        },
      });
    });

    await Promise.all(updates);

    // Audit log
    await auditAdmin(
      AuditAction.SETTINGS_CHANGED,
      session.adminId,
      "SystemSetting",
      category,
      { category, oldValues, newValues: settings }
    );

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Admin settings update error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update settings" } },
      { status: 500 }
    );
  }
}

// Generate API key
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, name, keyId } = body;

    if (action === "generateKey") {
      // Generate new API key
      const keyPrefix = process.env.NODE_ENV === "production" ? "fs_live_" : "fs_test_";
      const apiKey = keyPrefix + [...Array(32)].map(() => Math.random().toString(36)[2]).join("");

      const keyData = {
        name: name || "API Key",
        key: apiKey,
        createdAt: new Date().toISOString(),
        lastUsed: null,
      };

      const setting = await prisma.systemSetting.create({
        data: {
          key: `api.key.${Date.now()}`,
          value: JSON.stringify(keyData),
          type: "json",
          category: "api",
          updatedBy: session.adminId,
        },
      });

      await auditAdmin(
        AuditAction.ADMIN_ACTION,
        session.adminId,
        "ApiKey",
        setting.id,
        { action: "created", name: keyData.name }
      );

      return NextResponse.json({
        success: true,
        data: {
          id: setting.id,
          ...keyData,
        },
      });
    } else if (action === "deleteKey" && keyId) {
      await prisma.systemSetting.delete({
        where: { id: keyId },
      });

      await auditAdmin(
        AuditAction.ADMIN_ACTION,
        session.adminId,
        "ApiKey",
        keyId,
        { action: "deleted" }
      );

      return NextResponse.json({
        success: true,
        message: "API key deleted",
      });
    }

    return NextResponse.json(
      { success: false, error: { message: "Invalid action" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Admin API key error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to manage API key" } },
      { status: 500 }
    );
  }
}
