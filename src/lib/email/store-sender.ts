/**
 * Store-scoped email sender.
 *
 * Commerce emails (order confirmations, new-order alerts, shipping updates)
 * go through the STORE OWNER'S configured email provider from MarketingConfig
 * — not the platform's default transporter. That way buyers see the store's
 * branded From address and the store covers its own deliverability.
 *
 * Falls back to the platform's default sendEmail() when the owner hasn't
 * configured / verified / enabled a provider, so the system still works on
 * new stores during onboarding.
 */

import { prisma } from "@/lib/db/client";
import { sendEmail as sendPlatformEmail } from "./index";
import { createTransporter, sendViaMailgunApi } from "./marketing-sender";

export interface StoreEmailParams {
  /** User ID of the store owner (Store.userId). */
  storeOwnerUserId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /**
   * If true, the email MUST go through the store owner's configured provider.
   * When the owner has no verified/enabled provider, the send is skipped
   * instead of silently falling back to the platform transporter. Used for
   * customer-facing emails where the From address must be the store's.
   */
  requireOwner?: boolean;
}

/**
 * Send an email on behalf of a specific store. Routes through the owner's
 * MarketingConfig provider (SMTP / SendGrid / Mailgun / SES / Resend) when
 * configured and verified; otherwise uses the platform transporter so the
 * email still goes out rather than silently failing.
 */
export async function sendStoreEmail(params: StoreEmailParams): Promise<{ success: boolean; messageId?: string; error?: string; via: "owner" | "platform" }> {
  let cfg: { emailProvider: string; emailConfig: string; emailEnabled: boolean; emailVerified: boolean } | null = null;
  try {
    cfg = await prisma.marketingConfig.findUnique({
      where: { userId: params.storeOwnerUserId },
      select: { emailProvider: true, emailConfig: true, emailEnabled: true, emailVerified: true },
    });
  } catch (err) {
    console.error("[store-sender] MarketingConfig lookup failed:", err);
  }

  const usable = cfg && cfg.emailEnabled && cfg.emailVerified && cfg.emailProvider && cfg.emailProvider !== "NONE";

  if (!usable) {
    if (params.requireOwner) {
      console.warn(`[store-sender] Owner ${params.storeOwnerUserId} has no verified email provider — skipping customer-facing email "${params.subject}" (requireOwner=true)`);
      return { success: false, error: "Store owner has no verified email provider configured", via: "owner" };
    }
    const r = await sendPlatformEmail({
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });
    return { ...r, via: "platform" };
  }

  let emailConfig: Record<string, unknown> = {};
  try {
    emailConfig = JSON.parse(cfg!.emailConfig || "{}");
  } catch { /* fall through with empty config — will fail validation */ }

  const fromName = (emailConfig.fromName as string) || "Store";
  const fromEmail = (emailConfig.fromEmail as string) || (emailConfig.user as string) || "";
  const from = fromEmail ? `${fromName} <${fromEmail}>` : fromName;

  try {
    // Mailgun uses HTTP API rather than SMTP
    if (cfg!.emailProvider === "MAILGUN") {
      await sendViaMailgunApi(emailConfig, from, params.to, params.subject, params.html, params.text);
      console.log(`[store-sender] Sent via owner MAILGUN: ${params.subject} → ${params.to}`);
      return { success: true, via: "owner" };
    }

    const transport = createTransporter(cfg!.emailProvider, emailConfig);
    const info = await transport.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(params.replyTo && { replyTo: params.replyTo }),
    });
    console.log(`[store-sender] Sent via owner ${cfg!.emailProvider}: ${params.subject} → ${params.to}`);
    return { success: true, messageId: info.messageId, via: "owner" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    console.error(`[store-sender] Owner provider failed (${cfg!.emailProvider}):`, message);
    if (params.requireOwner) {
      // Customer-facing: do not fall back to platform so the From address
      // never silently becomes flowsmartly.com on a buyer's receipt.
      return { success: false, error: message, via: "owner" };
    }
    const fallback = await sendPlatformEmail({
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });
    return { ...fallback, via: "platform" };
  }
}
