/**
 * Marketing Email Sender
 * Shared utility for sending emails through user-configured providers.
 * Used by: test-email route, campaign send, automation triggers.
 */

import nodemailer from "nodemailer";
import { createHmac } from "crypto";

// Derive SES SMTP password from IAM secret access key
// See: https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html
function deriveSesSmtpPassword(secretAccessKey: string, region: string): string {
  const version = Buffer.from([0x04]);
  let key: Buffer = Buffer.from("AWS4" + secretAccessKey, "utf-8");
  for (const value of ["11111111", region, "ses", "aws4_request", "SendRawEmail"]) {
    key = createHmac("sha256", key).update(value).digest();
  }
  return Buffer.concat([version, key]).toString("base64");
}

// Create nodemailer transporter for SMTP-based providers
export function createTransporter(
  provider: string,
  emailConfig: Record<string, unknown>
): nodemailer.Transporter {
  switch (provider) {
    case "SMTP": {
      const port = emailConfig.port as number;
      // Port 465 = implicit SSL, all others (587, 25, 2525) = STARTTLS
      const secure = port === 465;
      return nodemailer.createTransport({
        host: emailConfig.host as string,
        port,
        secure,
        auth: {
          user: emailConfig.user as string,
          pass: emailConfig.password as string,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
      });
    }

    case "SENDGRID":
      return nodemailer.createTransport({
        host: "smtp.sendgrid.net",
        port: 587,
        secure: false,
        auth: {
          user: "apikey",
          pass: emailConfig.apiKey as string,
        },
      });

    case "RESEND":
      return nodemailer.createTransport({
        host: "smtp.resend.com",
        port: 465,
        secure: true,
        auth: {
          user: "resend",
          pass: emailConfig.apiKey as string,
        },
      });

    case "AMAZON_SES": {
      const region = (emailConfig.region as string) || "us-east-1";
      const smtpPassword = deriveSesSmtpPassword(
        emailConfig.secretAccessKey as string,
        region
      );
      return nodemailer.createTransport({
        host: `email-smtp.${region}.amazonaws.com`,
        port: 587,
        secure: false,
        auth: {
          user: emailConfig.accessKeyId as string,
          pass: smtpPassword,
        },
      });
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Send via Mailgun HTTP API (Mailgun SMTP requires separate SMTP credentials, not the API key)
export async function sendViaMailgunApi(
  emailConfig: Record<string, unknown>,
  from: string,
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> {
  const domain = emailConfig.domain as string;
  const apiKey = emailConfig.apiKey as string;

  const formData = new URLSearchParams();
  formData.append("from", from);
  formData.append("to", to);
  formData.append("subject", subject);
  formData.append("html", html);
  if (text) formData.append("text", text);

  const response = await fetch(
    `https://api.mailgun.net/v3/${domain}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mailgun API error (${response.status}): ${errorText}`);
  }
}

// Validate provider config before sending
export function validateEmailConfig(
  provider: string,
  emailConfig: Record<string, unknown>
): string | null {
  switch (provider) {
    case "SMTP":
      if (!emailConfig.host || !emailConfig.port) return "SMTP host and port are required";
      if (!emailConfig.user || !emailConfig.password) return "SMTP username and password are required";
      break;
    case "SENDGRID":
    case "RESEND":
      if (!emailConfig.apiKey || emailConfig.apiKey === "********") return "API key is required. Please re-enter and save settings.";
      break;
    case "MAILGUN":
      if (!emailConfig.apiKey || emailConfig.apiKey === "********") return "API key is required. Please re-enter and save settings.";
      if (!emailConfig.domain) return "Mailgun domain is required";
      break;
    case "AMAZON_SES":
      if (!emailConfig.accessKeyId || !emailConfig.secretAccessKey) return "AWS credentials are required";
      break;
    case "NONE":
      return "No email provider configured";
    default:
      return `Unsupported provider: ${provider}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Merge Tag Types
// ---------------------------------------------------------------------------

export interface MergeTagContact {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  birthday?: string | null;
  company?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  createdAt?: Date | string | null;
}

export interface MergeTagContext {
  user?: {
    plan?: string | null;
    lastLoginAt?: Date | string | null;
  };
  couponCode?: string;
  referralLink?: string;
  unsubscribeUrl?: string;
}

// Re-export client-safe merge tag definitions
export { MERGE_TAGS, type MergeTagCategory } from "./merge-tags";

// ---------------------------------------------------------------------------
// Replace merge tags in content
// ---------------------------------------------------------------------------

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysBetween(start: Date | string, end: Date): number {
  const s = typeof start === "string" ? new Date(start) : start;
  return Math.floor((end.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

export function replaceMergeTags(
  content: string,
  contact: MergeTagContact,
  context?: MergeTagContext
): string {
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "";
  const daysAsClient = contact.createdAt
    ? String(daysBetween(contact.createdAt, new Date()))
    : "";

  return content
    // Contact info
    .replace(/\{\{firstName\}\}/g, contact.firstName || "")
    .replace(/\{\{lastName\}\}/g, contact.lastName || "")
    .replace(/\{\{name\}\}/g, fullName)
    .replace(/\{\{email\}\}/g, contact.email || "")
    .replace(/\{\{phone\}\}/g, contact.phone || "")
    .replace(/\{\{company\}\}/g, contact.company || "")
    .replace(/\{\{city\}\}/g, contact.city || "")
    .replace(/\{\{state\}\}/g, contact.state || "")
    // Dates
    .replace(/\{\{birthday\}\}/g, contact.birthday || "")
    .replace(/\{\{signupDate\}\}/g, formatDate(contact.createdAt))
    .replace(/\{\{daysAsClient\}\}/g, daysAsClient)
    // Business (from context)
    .replace(/\{\{planName\}\}/g, context?.user?.plan || "")
    .replace(/\{\{lastLogin\}\}/g, formatDate(context?.user?.lastLoginAt))
    // Links (from context)
    .replace(/\{\{couponCode\}\}/g, context?.couponCode || "")
    .replace(/\{\{referralLink\}\}/g, context?.referralLink || "")
    .replace(/\{\{unsubscribeLink\}\}/g, context?.unsubscribeUrl || "");
}

// Unified email sending function
export interface MarketingEmailParams {
  provider: string;
  emailConfig: Record<string, unknown>;
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendMarketingEmail(params: MarketingEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    if (params.provider === "MAILGUN") {
      await sendViaMailgunApi(
        params.emailConfig,
        params.from,
        params.to,
        params.subject,
        params.html,
        params.text
      );
      return { success: true };
    }

    const transporter = createTransporter(params.provider, params.emailConfig);
    const info = await transporter.sendMail({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// Get user-friendly error message from send errors
export function getEmailErrorMessage(errorMessage: string): string {
  if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
    return "Could not connect to the email server. Please check your host/port settings.";
  }
  if (errorMessage.includes("EAUTH") || errorMessage.includes("Invalid login") || errorMessage.includes("authentication")) {
    return "Authentication failed. Please check your username/password or API key.";
  }
  if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timeout")) {
    return "Connection timed out. Please check your server settings and firewall.";
  }
  if (errorMessage.includes("self signed") || errorMessage.includes("certificate") || errorMessage.includes("wrong version number") || errorMessage.includes("tls_validate_record_header")) {
    return "SSL/TLS error. Port 465 requires SSL, while port 587 uses STARTTLS.";
  }
  return `Email sending failed: ${errorMessage}`;
}
