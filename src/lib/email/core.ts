import { APP_NAME, APP_URL, FROM_EMAIL, getTransporter } from "./config";

export function baseTemplate(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</span>` : ""}
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #ffffff; padding: 32px 24px; text-align: center; border-bottom: 1px solid #e4e4e7; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; }
    .content { padding: 32px 24px; color: #18181b; }
    .content h2 { color: #18181b; margin: 0 0 16px 0; font-size: 24px; }
    .content p { margin: 0 0 16px 0; line-height: 1.6; color: #3f3f46; }
    .button { display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0; }
    .button:hover { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); }
    .footer { padding: 24px; text-align: center; color: #71717a; font-size: 14px; border-top: 1px solid #e4e4e7; }
    .footer a { color: #0ea5e9; text-decoration: none; }
    .stats-box { background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .stats-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e4e4e7; }
    .stats-row:last-child { border-bottom: none; }
    .highlight { background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .code { background-color: #f4f4f5; padding: 16px 24px; border-radius: 8px; font-family: monospace; font-size: 32px; letter-spacing: 4px; text-align: center; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="${APP_URL}" style="text-decoration:none;">
        <img src="${APP_URL}/logo.png" alt="${APP_NAME}" style="max-height:48px;max-width:200px;" />
      </a>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      <p>
        <a href="${APP_URL}">Visit ${APP_NAME}</a> |
        <a href="${APP_URL}/settings">Manage Preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}

export async function sendEmail(params: SendEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const transport = getTransporter();

  if (!transport) {
    console.log("[Email] Skipped (SMTP not configured):", params.subject);
    return { success: false, error: "Email service not configured" };
  }

  try {
    const info = await transport.sendMail({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(params.replyTo && { replyTo: params.replyTo }),
      ...(params.attachments?.length && { attachments: params.attachments }),
    });

    console.log("[Email] Sent:", params.subject, "to", params.to);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}
