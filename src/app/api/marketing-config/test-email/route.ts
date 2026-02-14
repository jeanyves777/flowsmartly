import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import {
  sendMarketingEmail,
  validateEmailConfig,
  getEmailErrorMessage,
} from "@/lib/email/marketing-sender";

const APP_NAME = "FlowSmartly";

function buildTestEmailHtml(provider: string, fromEmail: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <div style="background:linear-gradient(135deg,#0ea5e9,#8b5cf6);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;">${APP_NAME}</h1>
    </div>
    <div style="padding:32px 24px;color:#18181b;">
      <h2 style="margin:0 0 16px;">Test Email Successful!</h2>
      <p style="line-height:1.6;color:#3f3f46;">
        Your email configuration is working correctly. This test email was sent using your <strong>${provider}</strong> provider.
      </p>
      <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
        <strong>Configuration Verified</strong><br>
        Provider: ${provider}<br>
        From: ${fromEmail}<br>
        Time: ${new Date().toLocaleString()}
      </div>
      <p style="line-height:1.6;color:#3f3f46;">
        You can now start sending email marketing campaigns from ${APP_NAME}.
      </p>
    </div>
    <div style="padding:24px;text-align:center;color:#71717a;font-size:14px;border-top:1px solid #e4e4e7;">
      <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// POST /api/marketing-config/test-email - Send a test email
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { testEmail } = body;

    if (!testEmail) {
      return NextResponse.json(
        { success: false, error: { message: "Test email address is required" } },
        { status: 400 }
      );
    }

    const config = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: { message: "Marketing config not found. Please save your settings first." } },
        { status: 404 }
      );
    }

    let emailConfig: Record<string, unknown>;
    try {
      emailConfig = JSON.parse(config.emailConfig);
    } catch {
      return NextResponse.json(
        { success: false, error: { message: "Invalid email configuration. Please re-save your settings." } },
        { status: 400 }
      );
    }

    const validationError = validateEmailConfig(config.emailProvider, emailConfig);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: { message: validationError } },
        { status: 400 }
      );
    }

    const fromEmail = config.defaultFromEmail || testEmail;
    const fromName = config.defaultFromName || APP_NAME;

    const result = await sendMarketingEmail({
      provider: config.emailProvider,
      emailConfig,
      from: `${fromName} <${fromEmail}>`,
      to: testEmail,
      subject: `${APP_NAME} - Test Email`,
      html: buildTestEmailHtml(config.emailProvider, fromEmail),
      text: `This is a test email from ${APP_NAME}. Your ${config.emailProvider} email configuration is working correctly.`,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: getEmailErrorMessage(result.error || "Unknown error") } },
        { status: 500 }
      );
    }

    await prisma.marketingConfig.update({
      where: { userId: session.userId },
      data: { emailVerified: true, emailEnabled: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: `Test email sent successfully to ${testEmail}`,
        verified: true,
      },
    });
  } catch (error) {
    console.error("Test email error:", error);
    const message = error instanceof Error ? getEmailErrorMessage(error.message) : "Failed to send test email";
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    );
  }
}
