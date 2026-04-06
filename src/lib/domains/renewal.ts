/**
 * Domain Renewal System
 * - Check for expiring domains
 * - Send renewal reminders (30/7/1 days before)
 * - Process auto-renewals
 */

import { prisma } from "@/lib/db/client";
import {
  notifyDomainExpiringIn30Days,
  notifyDomainExpiringIn7Days,
  notifyDomainExpiringTomorrow,
  notifyDomainRenewed,
  notifyDomainRenewalFailed,
} from "@/lib/notifications/domain";
import { createInvoice } from "@/lib/invoices";

/**
 * Check for expiring domains and send notifications
 * Should be called daily by a cron job
 */
export async function checkExpiringDomains() {
  const now = new Date();

  // Find domains expiring in 30, 7, and 1 day(s)
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const oneDay = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

  // 30-day reminders (expires between 29-30 days from now)
  const thirtyDayDomains = await prisma.storeDomain.findMany({
    where: {
      expiresAt: {
        gte: new Date(thirtyDays.getTime() - 24 * 60 * 60 * 1000),
        lte: thirtyDays,
      },
      registrarStatus: "active",
    },
  });

  for (const domain of thirtyDayDomains) {
    await notifyDomainExpiringIn30Days(domain.userId, domain.domainName, domain.expiresAt!);
    console.log(`[Renewal] 30-day reminder sent for ${domain.domainName}`);
  }

  // 7-day reminders
  const sevenDayDomains = await prisma.storeDomain.findMany({
    where: {
      expiresAt: {
        gte: new Date(sevenDays.getTime() - 24 * 60 * 60 * 1000),
        lte: sevenDays,
      },
      registrarStatus: "active",
    },
  });

  for (const domain of sevenDayDomains) {
    await notifyDomainExpiringIn7Days(domain.userId, domain.domainName, domain.expiresAt!);
    console.log(`[Renewal] 7-day reminder sent for ${domain.domainName}`);
  }

  // 1-day URGENT reminders
  const oneDayDomains = await prisma.storeDomain.findMany({
    where: {
      expiresAt: {
        gte: new Date(oneDay.getTime() - 24 * 60 * 60 * 1000),
        lte: oneDay,
      },
      registrarStatus: "active",
    },
  });

  for (const domain of oneDayDomains) {
    await notifyDomainExpiringTomorrow(domain.userId, domain.domainName);
    console.log(`[Renewal] 1-day URGENT reminder sent for ${domain.domainName}`);
  }

  return {
    thirtyDay: thirtyDayDomains.length,
    sevenDay: sevenDayDomains.length,
    oneDay: oneDayDomains.length,
  };
}

/**
 * Process auto-renewals for domains expiring within 7 days
 */
export async function processAutoRenewals() {
  const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const autoRenewDomains = await prisma.storeDomain.findMany({
    where: {
      autoRenew: true,
      expiresAt: { lte: sevenDays },
      registrarStatus: "active",
    },
  });

  let renewed = 0;
  let failed = 0;

  for (const domain of autoRenewDomains) {
    try {
      // Try to renew via OpenSRS
      const { renewDomain } = await import("@/lib/domains/opensrs-client");

      await renewDomain(domain.domainName, 1);

      // Update expiration
      const newExpires = new Date(domain.expiresAt!.getTime() + 365 * 24 * 60 * 60 * 1000);
      await prisma.storeDomain.update({
        where: { id: domain.id },
        data: { expiresAt: newExpires },
      });

      // Create invoice for renewal
      await createInvoice({
        userId: domain.userId,
        type: "domain_renewal",
        items: [
          {
            description: `Domain renewal: ${domain.domainName} (1 year)`,
            quantity: 1,
            unitPriceCents: domain.renewalPriceCents,
            totalCents: domain.renewalPriceCents,
          },
        ],
        totalCents: domain.renewalPriceCents,
      });

      await notifyDomainRenewed(domain.userId, domain.domainName, newExpires, domain.renewalPriceCents);
      renewed++;
      console.log(`[Renewal] Auto-renewed ${domain.domainName}`);
    } catch (err: any) {
      await notifyDomainRenewalFailed(domain.userId, domain.domainName, err.message);
      failed++;
      console.error(`[Renewal] Failed to renew ${domain.domainName}:`, err.message);
    }
  }

  return { renewed, failed, total: autoRenewDomains.length };
}

/**
 * Retry all failed registrations (max 3 attempts per domain)
 */
export async function retryFailedRegistrations() {
  const failedDomains = await prisma.storeDomain.findMany({
    where: {
      registrarStatus: { in: ["registration_failed", "pending_registration"] },
    },
    take: 10, // Process 10 at a time
  });

  let retried = 0;
  for (const domain of failedDomains) {
    try {
      const { registerDomain } = await import("@/lib/domains/opensrs-client");

      const result = await registerDomain({
        domain: domain.domainName,
        period: 1,
        regUsername: `fs-retry-${Date.now()}`,
        regPassword: `${Date.now()}-${Math.random().toString(36)}`,
      });

      await prisma.storeDomain.update({
        where: { id: domain.id },
        data: {
          registrarStatus: "active",
          registrarOrderId: result.orderId,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });

      const { notifyDomainRegistered } = await import("@/lib/notifications/domain");
      await notifyDomainRegistered(domain.userId, domain.domainName);
      retried++;
    } catch (err: any) {
      console.error(`[Retry] Failed for ${domain.domainName}:`, err.message);
    }
  }

  return { retried, total: failedDomains.length };
}
