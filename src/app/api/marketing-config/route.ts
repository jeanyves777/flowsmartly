import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { isValidEmailAddress } from "@/lib/email/recipients";

// Email provider types
export type EmailProvider = "NONE" | "SMTP" | "SENDGRID" | "MAILGUN" | "AMAZON_SES" | "RESEND";
const VALID_EMAIL_PROVIDERS = new Set<EmailProvider>(["NONE", "SMTP", "SENDGRID", "MAILGUN", "AMAZON_SES", "RESEND"]);

// GET /api/marketing-config - Get user's marketing configuration
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    let config = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
    });

    // Create default config if it doesn't exist
    if (!config) {
      config = await prisma.marketingConfig.create({
        data: {
          userId: session.userId,
        },
      });
    }

    // Parse the email config JSON
    let emailConfig = {};
    try {
      emailConfig = JSON.parse(config.emailConfig);
    } catch {
      emailConfig = {};
    }

    // Hide sensitive data
    const safeEmailConfig = {
      ...emailConfig,
      password: emailConfig && "password" in emailConfig ? "********" : undefined,
      apiKey: emailConfig && "apiKey" in emailConfig ? "********" : undefined,
    };

    return NextResponse.json({
      success: true,
      data: {
        config: {
          id: config.id,
          // Email
          emailProvider: config.emailProvider,
          emailConfig: safeEmailConfig,
          emailVerified: config.emailVerified,
          emailEnabled: config.emailEnabled,
          emailPricePerSend: config.emailPricePerSend,
          emailMonthlyLimit: config.emailMonthlyLimit,
          emailSentThisMonth: config.emailSentThisMonth,
          // SMS
          smsEnabled: config.smsEnabled,
          smsPhoneNumber: config.smsPhoneNumber,
          smsVerified: config.smsVerified,
          smsPricePerSend: config.smsPricePerSend,
          smsMonthlyLimit: config.smsMonthlyLimit,
          smsSentThisMonth: config.smsSentThisMonth,
          smsTollfreeVerifyStatus: config.smsTollfreeVerifyStatus,
          smsComplianceStatus: config.smsComplianceStatus,
          smsOptInImageUrl: config.smsOptInImageUrl,
          smsA2pBrandStatus: config.smsA2pBrandStatus,
          smsA2pCampaignStatus: config.smsA2pCampaignStatus,
          // Defaults
          defaultFromName: config.defaultFromName,
          defaultFromEmail: config.defaultFromEmail,
          defaultReplyTo: config.defaultReplyTo,
          // Meta
          usageResetDate: config.usageResetDate.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Get marketing config error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch marketing config" } },
      { status: 500 }
    );
  }
}

// PATCH /api/marketing-config - Update marketing configuration
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      emailProvider,
      emailConfig,
      emailEnabled,
      defaultFromName,
      defaultFromEmail,
      defaultReplyTo,
    } = body;

    // Get existing config
    let existingConfig = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
    });

    if (!existingConfig) {
      existingConfig = await prisma.marketingConfig.create({
        data: { userId: session.userId },
      });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (emailProvider !== undefined) {
      if (!VALID_EMAIL_PROVIDERS.has(emailProvider)) {
        return NextResponse.json(
          { success: false, error: { message: "Invalid email provider" } },
          { status: 400 }
        );
      }
      updateData.emailProvider = emailProvider;
    }

    if (emailConfig !== undefined) {
      // Merge with existing config to preserve sensitive data if not provided
      let existingEmailConfig = {};
      try {
        existingEmailConfig = JSON.parse(existingConfig.emailConfig);
      } catch {
        existingEmailConfig = {};
      }

      // If password/apiKey is "********", keep the existing value
      const mergedConfig = { ...existingEmailConfig, ...emailConfig };
      if (emailConfig.password === "********" && existingEmailConfig && "password" in existingEmailConfig) {
        mergedConfig.password = (existingEmailConfig as Record<string, unknown>).password;
      }
      if (emailConfig.apiKey === "********" && existingEmailConfig && "apiKey" in existingEmailConfig) {
        mergedConfig.apiKey = (existingEmailConfig as Record<string, unknown>).apiKey;
      }

      updateData.emailConfig = JSON.stringify(mergedConfig);
      // Reset verification when config changes
      updateData.emailVerified = false;
    }

    if (emailEnabled !== undefined) {
      updateData.emailEnabled = emailEnabled;
    }

    if (defaultFromName !== undefined) {
      updateData.defaultFromName = defaultFromName;
    }

    if (defaultFromEmail !== undefined) {
      if (defaultFromEmail && !isValidEmailAddress(defaultFromEmail)) {
        return NextResponse.json(
          { success: false, error: { message: "Default from email must be a valid email address" } },
          { status: 400 }
        );
      }
      updateData.defaultFromEmail = defaultFromEmail || null;
    }

    if (defaultReplyTo !== undefined) {
      if (defaultReplyTo && !isValidEmailAddress(defaultReplyTo)) {
        return NextResponse.json(
          { success: false, error: { message: "Reply-to email must be a valid email address" } },
          { status: 400 }
        );
      }
      updateData.defaultReplyTo = defaultReplyTo || null;
    }

    const config = await prisma.marketingConfig.update({
      where: { userId: session.userId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { config },
    });
  } catch (error) {
    console.error("Update marketing config error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update marketing config" } },
      { status: 500 }
    );
  }
}
