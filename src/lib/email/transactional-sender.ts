/**
 * Transactional Email Sender
 * Sends system-triggered emails (password reset, verification, etc.)
 * No opt-in required — these are necessary communications.
 */

import { sendMarketingEmail } from "./marketing-sender";
import { replaceMergeTags, type MergeTagContact, type MergeTagContext } from "./marketing-sender";
import { prisma } from "@/lib/db/client";
import { getTemplateById } from "@/lib/marketing/templates";

export interface TransactionalEmailParams {
  userId: string;
  to: string;
  templateId: string;
  variables?: Record<string, string>;
  contact?: MergeTagContact;
}

/**
 * Send a transactional email using a template from the library.
 * Falls back to the user's configured email provider.
 */
export async function sendTransactionalEmail(params: TransactionalEmailParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { userId, to, templateId, variables = {}, contact } = params;

    // Get the template
    const template = getTemplateById(templateId);
    if (!template || !template.defaultEmail) {
      return { success: false, error: `Template not found: ${templateId}` };
    }

    // Get user's marketing config for email provider settings
    const config = await prisma.marketingConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      return { success: false, error: "No email provider configured" };
    }

    // Replace merge tags in subject and content
    let subject = template.defaultEmail.subject;
    let html = template.defaultEmail.htmlContent;
    let text = template.defaultEmail.content;

    // Apply merge tags from contact if available
    if (contact) {
      subject = replaceMergeTags(subject, contact);
      html = replaceMergeTags(html, contact);
      text = replaceMergeTags(text, contact);
    }

    // Apply custom variables (e.g., {{resetLink}}, {{verificationCode}})
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      subject = subject.replace(regex, value);
      html = html.replace(regex, value);
      text = text.replace(regex, value);
    }

    // Parse email config
    const emailConfig = typeof config.emailConfig === "string"
      ? JSON.parse(config.emailConfig)
      : config.emailConfig;

    // Build the from address
    const fromName = config.defaultFromName || "FlowSmartly";
    const fromEmail = config.defaultFromEmail
      || `noreply@${new URL(process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com").hostname}`;
    const from = `${fromName} <${fromEmail}>`;

    // Send via configured provider
    const result = await sendMarketingEmail({
      provider: config.emailProvider,
      emailConfig: emailConfig as Record<string, unknown>,
      from,
      to,
      subject,
      html,
      text,
    });

    if (!result.success) {
      console.error(`Transactional email failed [${templateId}]:`, result.error);
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (err) {
    console.error("Transactional email error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
