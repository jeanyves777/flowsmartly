/**
 * Domain Event Notifications — email + system (bell) notification for every domain event
 */

import { sendEmail, baseTemplate } from "@/lib/email/index";
import { createNotification } from "@/lib/notifications/index";
import { prisma } from "@/lib/db/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";

async function getUserEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email || null;
}

function domainEmailContent(title: string, message: string, cta?: { text: string; url: string }): string {
  return `
    <div style="text-align:center;padding:30px 0 10px">
      <img src="${APP_URL}/logo.png" alt="FlowSmartly" width="40" height="40" style="border-radius:8px" />
    </div>
    <h1 style="font-size:24px;font-weight:700;color:#1a1a1a;margin:20px 0 10px;text-align:center">${title}</h1>
    <p style="font-size:16px;color:#4b5563;line-height:1.6;margin:0 0 20px">${message}</p>
    ${cta ? `<div style="text-align:center;margin:30px 0"><a href="${cta.url}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">${cta.text}</a></div>` : ""}
    <p style="font-size:12px;color:#9ca3af;margin-top:30px;border-top:1px solid #e5e7eb;padding-top:15px">This is an automated notification from FlowSmartly. You can manage your domain settings at <a href="${APP_URL}/domains" style="color:#3b82f6">flowsmartly.com/domains</a>.</p>
  `;
}

// ─── 1. Domain Registration Confirmation ───

export async function notifyDomainRegistered(userId: string, domain: string) {
  const email = await getUserEmail(userId);

  await createNotification({
    userId,
    type: "DOMAIN_REGISTERED",
    title: "Domain Registered",
    message: `Your domain ${domain} has been successfully registered!`,
    actionUrl: "/domains",
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `Domain Registered: ${domain}`,
      html: baseTemplate(domainEmailContent(
        "Domain Registered! 🎉",
        `Your domain <strong>${domain}</strong> has been successfully registered. We're now setting up DNS and SSL — this usually takes a few minutes.`,
        { text: "View Domain", url: `${APP_URL}/domains` }
      )),
    });
  }
}

// ─── 2. Domain Active (DNS + SSL Ready) ───

export async function notifyDomainActive(userId: string, domain: string) {
  const email = await getUserEmail(userId);

  await createNotification({
    userId,
    type: "DOMAIN_ACTIVE",
    title: "Domain is Live!",
    message: `${domain} is now active with SSL enabled.`,
    actionUrl: `//${domain}`,
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `Your domain ${domain} is now live!`,
      html: baseTemplate(domainEmailContent(
        "Your Domain is Live! 🚀",
        `Great news! <strong>${domain}</strong> is now fully active with SSL encryption enabled. Your visitors can now access your site securely at <strong>https://${domain}</strong>.`,
        { text: "Visit Your Site", url: `https://${domain}` }
      )),
    });
  }
}

// ─── 3. Registration Failed ───

export async function notifyDomainRegistrationFailed(userId: string, domain: string, error?: string) {
  const email = await getUserEmail(userId);

  await createNotification({
    userId,
    type: "DOMAIN_REGISTRATION_FAILED",
    title: "Domain Registration Failed",
    message: `We couldn't register ${domain}. You can retry from the domains page.`,
    actionUrl: "/domains",
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `Action Required: ${domain} registration failed`,
      html: baseTemplate(domainEmailContent(
        "Registration Issue",
        `We encountered a problem registering <strong>${domain}</strong>. ${error ? `Error: ${error}. ` : ""}Don't worry — you can retry the registration from your domains dashboard. If the issue persists, our support team is here to help.`,
        { text: "Retry Registration", url: `${APP_URL}/domains` }
      )),
    });
  }
}

// ─── 4. Renewal Reminder (30 days) ───

export async function notifyDomainExpiringIn30Days(userId: string, domain: string, expiresAt: Date) {
  const email = await getUserEmail(userId);
  const dateStr = expiresAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  await createNotification({
    userId,
    type: "DOMAIN_EXPIRING",
    title: "Domain Renewal Reminder",
    message: `${domain} expires on ${dateStr} (30 days). Ensure auto-renew is enabled.`,
    actionUrl: "/domains",
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `Reminder: ${domain} expires in 30 days`,
      html: baseTemplate(domainEmailContent(
        "Domain Renewal Reminder",
        `Your domain <strong>${domain}</strong> expires on <strong>${dateStr}</strong> (30 days from now). If auto-renewal is enabled, we'll automatically renew it. Otherwise, please renew manually to avoid losing your domain.`,
        { text: "Manage Domain", url: `${APP_URL}/domains` }
      )),
    });
  }
}

// ─── 5. Renewal Reminder (7 days) ───

export async function notifyDomainExpiringIn7Days(userId: string, domain: string, expiresAt: Date) {
  const email = await getUserEmail(userId);
  const dateStr = expiresAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  await createNotification({
    userId,
    type: "DOMAIN_EXPIRING",
    title: "⚠️ Domain Expiring Soon",
    message: `${domain} expires in 7 days (${dateStr}). Renew now to keep your domain.`,
    actionUrl: "/domains",
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `⚠️ ${domain} expires in 7 days — action required`,
      html: baseTemplate(domainEmailContent(
        "⚠️ Domain Expiring Soon",
        `Your domain <strong>${domain}</strong> expires on <strong>${dateStr}</strong> — that's only 7 days away! If you don't renew, your website will go offline and someone else could register the domain.`,
        { text: "Renew Now", url: `${APP_URL}/domains` }
      )),
    });
  }
}

// ─── 6. Renewal Reminder (1 day — URGENT) ───

export async function notifyDomainExpiringTomorrow(userId: string, domain: string) {
  const email = await getUserEmail(userId);

  await createNotification({
    userId,
    type: "DOMAIN_EXPIRING",
    title: "🚨 Domain Expires Tomorrow!",
    message: `URGENT: ${domain} expires tomorrow! Renew immediately to avoid losing it.`,
    actionUrl: "/domains",
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `🚨 URGENT: ${domain} expires TOMORROW`,
      html: baseTemplate(domainEmailContent(
        "🚨 Domain Expires Tomorrow!",
        `<strong>URGENT:</strong> Your domain <strong>${domain}</strong> expires <strong>tomorrow</strong>. If it's not renewed, your website will go offline immediately. Please renew now to keep your domain active.`,
        { text: "Renew Immediately", url: `${APP_URL}/domains` }
      )),
    });
  }
}

// ─── 7. Renewal Success ───

export async function notifyDomainRenewed(userId: string, domain: string, newExpiresAt: Date, cost: number) {
  const email = await getUserEmail(userId);
  const dateStr = newExpiresAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const costStr = `$${(cost / 100).toFixed(2)}`;

  await createNotification({
    userId,
    type: "DOMAIN_RENEWED",
    title: "Domain Renewed ✓",
    message: `${domain} has been renewed until ${dateStr}. Charged: ${costStr}.`,
    actionUrl: "/domains",
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `Domain Renewed: ${domain}`,
      html: baseTemplate(domainEmailContent(
        "Domain Renewed Successfully ✓",
        `Your domain <strong>${domain}</strong> has been renewed and is now valid until <strong>${dateStr}</strong>. Amount charged: <strong>${costStr}</strong>.`,
        { text: "View Domain", url: `${APP_URL}/domains` }
      )),
    });
  }
}

// ─── 8. Renewal Failed ───

export async function notifyDomainRenewalFailed(userId: string, domain: string, error?: string) {
  const email = await getUserEmail(userId);

  await createNotification({
    userId,
    type: "DOMAIN_RENEWAL_FAILED",
    title: "Domain Renewal Failed",
    message: `We couldn't renew ${domain}. Please update your payment method and try again.`,
    actionUrl: "/domains",
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `Action Required: ${domain} renewal failed`,
      html: baseTemplate(domainEmailContent(
        "Domain Renewal Failed",
        `We were unable to renew <strong>${domain}</strong>. ${error ? `Reason: ${error}. ` : ""}Please update your payment method or manually renew to keep your domain active. If the domain expires, your website will go offline.`,
        { text: "Renew Manually", url: `${APP_URL}/domains` }
      )),
    });
  }
}
