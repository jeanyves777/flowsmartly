import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  sendMarketingEmail,
  validateEmailConfig,
  replaceMergeTags,
} from "@/lib/email/marketing-sender";
import { getHolidayById, getHolidayDate } from "@/lib/marketing/holidays";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { triggerActivitySyncForUser } from "@/lib/strategy/activity-matcher";
import { sendSMS, formatPhoneNumber } from "@/lib/twilio";
import { compositeImageWithText } from "@/lib/media/image-compositor";
import { uploadToS3 } from "@/lib/utils/s3-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AutomationDetail {
  automationId: string;
  name: string;
  sent: number;
  failed: number;
  skipped: number;
  error?: string;
}

interface CachedMarketingConfig {
  id: string;
  emailProvider: string;
  emailConfig: string;
  emailEnabled: boolean;
  emailVerified: boolean;
  emailMonthlyLimit: number;
  emailSentThisMonth: number;
  defaultFromName: string | null;
  defaultFromEmail: string | null;
  defaultReplyTo: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get today's date components in a specific IANA timezone.
 * Returns year, month (1-12), day (1-31), and the Date representing
 * the start of that local day in UTC.
 */
function getTodayInTimezone(tz: string): {
  year: number;
  month: number;
  day: number;
  startOfDay: Date;
} {
  const now = new Date();
  // Format the current instant in the target timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  let day = now.getDate();

  for (const p of parts) {
    if (p.type === "year") year = parseInt(p.value, 10);
    if (p.type === "month") month = parseInt(p.value, 10);
    if (p.type === "day") day = parseInt(p.value, 10);
  }

  // Build start-of-day in UTC for the given timezone date.
  // We use the local date components to create a "logical" start-of-day marker
  // for database comparisons (sentAt >= startOfDay).
  const startOfDay = new Date(
    Date.UTC(year, month - 1, day, 0, 0, 0, 0)
  );

  return { year, month, day, startOfDay };
}

/**
 * Format month and day as "MM-DD" to match the Contact.birthday field format.
 */
function formatMMDD(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Add days to a { month, day, year } date and return new month/day values.
 */
function addDaysToDate(
  year: number,
  month: number,
  day: number,
  offset: number
): { month: number; day: number } {
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + offset);
  return { month: d.getMonth() + 1, day: d.getDate() };
}

// ---------------------------------------------------------------------------
// POST /api/automations/trigger
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // ── Auth: shared secret ──
    const triggerSecret = process.env.AUTOMATION_TRIGGER_SECRET;
    const authHeader = request.headers.get("authorization");
    if (!triggerSecret || authHeader !== `Bearer ${triggerSecret}`) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // ── Parse body ──
    let body: { type?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — defaults to "all"
    }

    const filterType = body.type || "all"; // "birthday" | "holiday" | "anniversary" | "inactivity" | "trial_ending" | "all"
    const validFilterTypes = ["birthday", "holiday", "anniversary", "inactivity", "trial_ending", "all"];
    if (!validFilterTypes.includes(filterType)) {
      return NextResponse.json(
        { success: false, error: { message: `Invalid type. Use one of: ${validFilterTypes.join(", ")}` } },
        { status: 400 }
      );
    }

    // ── Query enabled automations ──
    // Note: PAYMENT_FAILED, ABANDONED_CART, and SUBSCRIPTION_CHANGE are event-driven
    // types triggered from webhooks (e.g., Stripe webhooks, cart events), not from
    // this cron endpoint. They are handled in their respective webhook handlers.
    const cronTypes: Record<string, string[]> = {
      birthday: ["BIRTHDAY"],
      holiday: ["HOLIDAY"],
      anniversary: ["ANNIVERSARY"],
      inactivity: ["INACTIVITY"],
      trial_ending: ["TRIAL_ENDING"],
      all: ["BIRTHDAY", "HOLIDAY", "ANNIVERSARY", "INACTIVITY", "TRIAL_ENDING"],
    };
    const typeFilter: string[] = cronTypes[filterType] || cronTypes.all;

    const automations = await prisma.automation.findMany({
      where: {
        enabled: true,
        type: { in: typeFilter },
      },
      include: {
        contactList: true,
      },
    });

    // ── Marketing config cache (keyed by userId) ──
    const configCache = new Map<string, CachedMarketingConfig | null>();

    const getMarketingConfig = async (
      userId: string
    ): Promise<CachedMarketingConfig | null> => {
      if (configCache.has(userId)) {
        return configCache.get(userId)!;
      }
      const cfg = await prisma.marketingConfig.findUnique({
        where: { userId },
        select: {
          id: true,
          emailProvider: true,
          emailConfig: true,
          emailEnabled: true,
          emailVerified: true,
          emailMonthlyLimit: true,
          emailSentThisMonth: true,
          defaultFromName: true,
          defaultFromEmail: true,
          defaultReplyTo: true,
        },
      });
      configCache.set(userId, cfg);
      return cfg;
    };

    // ── Process each automation ──
    let totalProcessed = 0;
    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const details: AutomationDetail[] = [];

    for (const automation of automations) {
      totalProcessed++;
      const detail: AutomationDetail = {
        automationId: automation.id,
        name: automation.name,
        sent: 0,
        failed: 0,
        skipped: 0,
      };

      try {
        // Get today in the automation's timezone
        const tz = automation.timezone || "UTC";
        let today: ReturnType<typeof getTodayInTimezone>;
        try {
          today = getTodayInTimezone(tz);
        } catch {
          // Invalid timezone — fall back to UTC
          today = getTodayInTimezone("UTC");
        }

        // ── Determine if this automation should fire today ──

        if (automation.type === "BIRTHDAY") {
          // daysOffset defines when to send relative to the birthday:
          //   -1 => send 1 day before => look for birthdays on today + 1
          //    0 => send on the day   => look for birthdays on today
          //    1 => send 1 day after  => look for birthdays on today - 1
          const target = addDaysToDate(
            today.year,
            today.month,
            today.day,
            -automation.daysOffset
          );
          const targetMMDD = formatMMDD(target.month, target.day);

          // Get contacts matching birthday
          const contacts = await getMatchingContacts(
            automation.userId,
            automation.contactListId,
            automation.campaignType,
            { birthday: targetMMDD }
          );

          // Send to each contact
          const result = await sendToContacts(
            automation,
            contacts,
            today.startOfDay,
            getMarketingConfig
          );
          detail.sent = result.sent;
          detail.failed = result.failed;
          detail.skipped = result.skipped;
        } else if (automation.type === "HOLIDAY") {
          // Parse trigger JSON to get holidayId
          let triggerData: { holidayId?: string } = {};
          try {
            triggerData = JSON.parse(automation.trigger);
          } catch {
            detail.error = "Invalid trigger JSON";
            detail.skipped = 1;
            details.push(detail);
            totalSkipped++;
            continue;
          }

          if (!triggerData.holidayId) {
            detail.error = "No holidayId in trigger";
            detail.skipped = 1;
            details.push(detail);
            totalSkipped++;
            continue;
          }

          const holiday = getHolidayById(triggerData.holidayId);
          if (!holiday) {
            detail.error = `Unknown holiday: ${triggerData.holidayId}`;
            detail.skipped = 1;
            details.push(detail);
            totalSkipped++;
            continue;
          }

          // Get the holiday's date this year
          const holidayDate = getHolidayDate(holiday, today.year);

          // Calculate target date: holidayDate + daysOffset
          const targetDate = addDaysToDate(
            today.year,
            holidayDate.month,
            holidayDate.day,
            automation.daysOffset
          );

          // Check if today matches the target date
          if (today.month !== targetDate.month || today.day !== targetDate.day) {
            // Not today — skip this automation
            detail.skipped = 1;
            details.push(detail);
            totalSkipped++;
            continue;
          }

          // Get all eligible contacts (no birthday filter)
          const contacts = await getMatchingContacts(
            automation.userId,
            automation.contactListId,
            automation.campaignType,
            {}
          );

          // Send to each contact
          const result = await sendToContacts(
            automation,
            contacts,
            today.startOfDay,
            getMarketingConfig
          );
          detail.sent = result.sent;
          detail.failed = result.failed;
          detail.skipped = result.skipped;
        } else if (automation.type === "ANNIVERSARY") {
          // ── ANNIVERSARY: fires on the contact's signup anniversary ──
          // Similar to BIRTHDAY but matches Contact.createdAt month/day
          const target = addDaysToDate(
            today.year,
            today.month,
            today.day,
            -automation.daysOffset
          );
          const targetMMDD = formatMMDD(target.month, target.day);

          // Get all eligible contacts, then filter by createdAt month/day
          const allContacts = await getMatchingContacts(
            automation.userId,
            automation.contactListId,
            automation.campaignType,
            {}
          );

          // Query contacts with createdAt to filter by anniversary date
          const contactIds = allContacts.map((c) => c.id);
          const contactsWithDates = await prisma.contact.findMany({
            where: { id: { in: contactIds } },
            select: { id: true, createdAt: true },
          });

          const anniversaryContactIds = new Set(
            contactsWithDates
              .filter((c) => {
                const m = c.createdAt.getMonth() + 1;
                const d = c.createdAt.getDate();
                return formatMMDD(m, d) === targetMMDD;
              })
              .map((c) => c.id)
          );

          const anniversaryContacts = allContacts.filter((c) =>
            anniversaryContactIds.has(c.id)
          );

          const result = await sendToContacts(
            automation,
            anniversaryContacts,
            today.startOfDay,
            getMarketingConfig
          );
          detail.sent = result.sent;
          detail.failed = result.failed;
          detail.skipped = result.skipped;
        } else if (automation.type === "INACTIVITY") {
          // ── INACTIVITY: fires after N days of no login ──
          // Checks User.lastLoginAt for the automation owner's contacts
          let triggerData: { inactiveDays?: number } = {};
          try {
            triggerData = JSON.parse(automation.trigger);
          } catch {
            // Default to 30 days if trigger JSON is invalid
          }
          const inactiveDays = triggerData.inactiveDays || 30;
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

          // Get all eligible contacts, then filter to those whose associated
          // user is inactive. Contacts belong to the automation owner (userId),
          // but each contact may also represent a user in the system.
          // We match Contact.email to User.email to find the association.
          const allContacts = await getMatchingContacts(
            automation.userId,
            automation.contactListId,
            automation.campaignType,
            {}
          );

          // Look up which contacts correspond to inactive users by email
          const contactEmails = allContacts
            .map((c) => c.email)
            .filter((e): e is string => !!e);

          const matchedUsers = await prisma.user.findMany({
            where: {
              email: { in: contactEmails },
              OR: [
                { lastLoginAt: { lt: cutoffDate } },
                { lastLoginAt: null },
              ],
            },
            select: { email: true },
          });
          const inactiveEmails = new Set(matchedUsers.map((u) => u.email));

          const inactiveContacts = allContacts.filter(
            (c) => c.email && inactiveEmails.has(c.email)
          );

          const result = await sendToContacts(
            automation,
            inactiveContacts,
            today.startOfDay,
            getMarketingConfig
          );
          detail.sent = result.sent;
          detail.failed = result.failed;
          detail.skipped = result.skipped;
        } else if (automation.type === "TRIAL_ENDING") {
          // ── TRIAL_ENDING: fires N days before trial/plan expires ──
          let triggerData: { daysBeforeExpiry?: number } = {};
          try {
            triggerData = JSON.parse(automation.trigger);
          } catch {
            // Default to 3 days if trigger JSON is invalid
          }
          const daysBeforeExpiry = triggerData.daysBeforeExpiry || 3;

          // Calculate the target expiry date: users whose plan expires in
          // exactly N days from now should be notified today
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);
          const targetStart = new Date(
            Date.UTC(
              targetDate.getFullYear(),
              targetDate.getMonth(),
              targetDate.getDate(),
              0, 0, 0, 0
            )
          );
          const targetEnd = new Date(
            Date.UTC(
              targetDate.getFullYear(),
              targetDate.getMonth(),
              targetDate.getDate(),
              23, 59, 59, 999
            )
          );

          // Find users whose plan expires on the target date
          const expiringUsers = await prisma.user.findMany({
            where: {
              planExpiresAt: {
                gte: targetStart,
                lte: targetEnd,
              },
            },
            select: { email: true },
          });
          const expiringEmails = new Set(expiringUsers.map((u) => u.email));

          // Get all eligible contacts, then filter to those whose email
          // matches an expiring user
          const allContacts = await getMatchingContacts(
            automation.userId,
            automation.contactListId,
            automation.campaignType,
            {}
          );

          const expiringContacts = allContacts.filter(
            (c) => c.email && expiringEmails.has(c.email)
          );

          const result = await sendToContacts(
            automation,
            expiringContacts,
            today.startOfDay,
            getMarketingConfig
          );
          detail.sent = result.sent;
          detail.failed = result.failed;
          detail.skipped = result.skipped;
        }
        // Note: PAYMENT_FAILED, ABANDONED_CART, and SUBSCRIPTION_CHANGE are
        // event-driven automation types. They are NOT processed by this cron
        // endpoint. Instead, they are triggered from their respective webhook
        // handlers (e.g., Stripe payment_intent.payment_failed webhook,
        // cart abandonment detection, and Stripe customer.subscription.updated
        // webhook). See the webhook route handlers for their implementation.
      } catch (err) {
        console.error(
          `Automation ${automation.id} (${automation.name}) error:`,
          err
        );
        detail.error =
          err instanceof Error ? err.message : "Unknown error";
        detail.failed = 1;
      }

      totalSent += detail.sent;
      totalFailed += detail.failed;
      totalSkipped += detail.skipped;
      details.push(detail);
    }

    // Fire-and-forget: sync strategy tasks for users who had sends
    if (totalSent > 0) {
      const userIdsWithSends = new Set(
        automations
          .filter((a) => {
            const d = details.find((det) => det.automationId === a.id);
            return d && d.sent > 0;
          })
          .map((a) => a.userId)
      );
      for (const uid of userIdsWithSends) {
        triggerActivitySyncForUser(uid).catch((err) =>
          console.error(`Activity sync hook (automation trigger) failed for ${uid}:`, err)
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: totalProcessed,
        sent: totalSent,
        failed: totalFailed,
        skipped: totalSkipped,
        details,
      },
    });
  } catch (error) {
    console.error("Automation trigger error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to run automation trigger",
        },
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// getMatchingContacts
// ---------------------------------------------------------------------------

interface ContactForSend {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

async function getMatchingContacts(
  userId: string,
  contactListId: string | null,
  campaignType: string,
  filters: { birthday?: string }
): Promise<ContactForSend[]> {
  // Build the base where clause for the Contact model
  const contactWhere: Record<string, unknown> = {
    userId,
    status: "ACTIVE",
  };

  // Opt-in filter
  if (campaignType === "EMAIL") {
    contactWhere.emailOptedIn = true;
    contactWhere.email = { not: null };
  } else if (campaignType === "SMS") {
    contactWhere.smsOptedIn = true;
    contactWhere.phone = { not: null };
  }

  // Birthday filter
  if (filters.birthday) {
    contactWhere.birthday = filters.birthday;
  }

  if (contactListId) {
    // Get contacts from the specific list
    const members = await prisma.contactListMember.findMany({
      where: {
        contactListId,
        contact: contactWhere,
      },
      select: {
        contact: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });
    return members.map((m) => m.contact);
  } else {
    // All user's contacts matching filters
    const contacts = await prisma.contact.findMany({
      where: contactWhere,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
      },
    });
    return contacts;
  }
}

// ---------------------------------------------------------------------------
// sendToContacts
// ---------------------------------------------------------------------------

async function sendToContacts(
  automation: {
    id: string;
    userId: string;
    campaignType: string;
    subject: string | null;
    content: string;
    contentHtml: string | null;
    name: string;
    totalSent: number;
    imageUrl?: string | null;
    imageSource?: string | null;
    imageOverlayText?: string | null;
  },
  contacts: ContactForSend[],
  startOfToday: Date,
  getConfig: (userId: string) => Promise<CachedMarketingConfig | null>
): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  if (contacts.length === 0) {
    return { sent, failed, skipped };
  }

  // Route to email or SMS handler
  if (automation.campaignType === "SMS") {
    return sendSmsToContacts(automation, contacts, startOfToday);
  }

  if (automation.campaignType !== "EMAIL") {
    skipped = contacts.length;
    return { sent, failed, skipped };
  }

  // Load marketing config for this user
  const marketingConfig = await getConfig(automation.userId);
  if (!marketingConfig || (!marketingConfig.emailEnabled && !marketingConfig.emailVerified)) {
    // Cannot send — log as failed
    for (const contact of contacts) {
      await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          contactId: contact.id,
          status: "FAILED",
          error: "Email provider not configured or not enabled",
        },
      });
    }
    failed = contacts.length;
    return { sent, failed, skipped };
  }

  // Parse email config
  let emailConfig: Record<string, unknown>;
  try {
    emailConfig = JSON.parse(marketingConfig.emailConfig);
  } catch {
    for (const contact of contacts) {
      await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          contactId: contact.id,
          status: "FAILED",
          error: "Invalid email configuration JSON",
        },
      });
    }
    failed = contacts.length;
    return { sent, failed, skipped };
  }

  // Validate email config
  const validationError = validateEmailConfig(
    marketingConfig.emailProvider,
    emailConfig
  );
  if (validationError) {
    for (const contact of contacts) {
      await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          contactId: contact.id,
          status: "FAILED",
          error: validationError,
        },
      });
    }
    failed = contacts.length;
    return { sent, failed, skipped };
  }

  // Build "from" address
  const fromEmail =
    marketingConfig.defaultFromEmail || "noreply@flowsmartly.com";
  const fromName = marketingConfig.defaultFromName || "FlowSmartly";
  const from = `${fromName} <${fromEmail}>`;
  const replyTo = marketingConfig.defaultReplyTo || undefined;

  // Check credit balance before sending emails
  const emailCreditCost = await getDynamicCreditCost("EMAIL_SEND");
  const totalEmailCost = emailCreditCost * contacts.length;
  const userCreditBalance = await creditService.getBalance(automation.userId);

  if (userCreditBalance < totalEmailCost) {
    // Not enough credits — log all contacts as failed
    for (const contact of contacts) {
      await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          contactId: contact.id,
          status: "FAILED",
          error: `Insufficient credits. Need ${totalEmailCost}, have ${userCreditBalance}.`,
        },
      });
    }
    failed = contacts.length;
    return { sent, failed, skipped };
  }

  // Process each contact
  for (const contact of contacts) {
    // Check for duplicate send today
    const existingLog = await prisma.automationLog.findFirst({
      where: {
        automationId: automation.id,
        contactId: contact.id,
        sentAt: { gte: startOfToday },
      },
    });

    if (existingLog) {
      skipped++;
      continue;
    }

    // Personalize content
    const personalizedSubject = replaceMergeTags(
      automation.subject || automation.name,
      contact
    );
    let personalizedHtml = replaceMergeTags(
      automation.contentHtml || automation.content,
      contact
    );
    const personalizedText = replaceMergeTags(automation.content, contact);

    // Embed inline image if automation has one
    if (personalizedHtml && (automation.imageUrl || automation.imageSource === "contact_photo")) {
      let inlineImageUrl: string | undefined;

      if (automation.imageSource === "contact_photo") {
        if (contact.imageUrl) {
          const contactImg = contact.imageUrl;
          if (automation.imageOverlayText) {
            try {
              const overlayText = replaceMergeTags(automation.imageOverlayText, contact);
              const pngBuf = await compositeImageWithText({
                baseImageUrl: contactImg,
                text: overlayText,
              });
              const key = `composited/auto-${automation.id}-${contact.id}-${Date.now()}.png`;
              inlineImageUrl = await uploadToS3(key, pngBuf, "image/png");
            } catch {
              inlineImageUrl = contactImg;
            }
          } else {
            inlineImageUrl = contactImg;
          }
        }
      } else if (automation.imageUrl) {
        inlineImageUrl = automation.imageUrl;
      }

      if (inlineImageUrl) {
        const imgTag = `<div style="text-align:center;margin:20px 0;padding:0;"><img src="${inlineImageUrl}" alt="" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:8px;" /></div>`;
        // Insert image after first paragraph (greeting) for natural flow
        const firstPClose = personalizedHtml.indexOf("</p>");
        if (firstPClose !== -1) {
          const insertAt = firstPClose + 4;
          personalizedHtml = personalizedHtml.slice(0, insertAt) + imgTag + personalizedHtml.slice(insertAt);
        } else {
          const insertPoint = personalizedHtml.search(/<body[^>]*>/i);
          if (insertPoint !== -1) {
            const afterBody = personalizedHtml.indexOf(">", insertPoint) + 1;
            personalizedHtml = personalizedHtml.slice(0, afterBody) + imgTag + personalizedHtml.slice(afterBody);
          } else {
            personalizedHtml = imgTag + personalizedHtml;
          }
        }
      }
    }

    // Send the email
    const result = await sendMarketingEmail({
      provider: marketingConfig.emailProvider,
      emailConfig,
      from,
      to: contact.email!,
      subject: personalizedSubject,
      html: personalizedHtml,
      text: personalizedText,
      replyTo,
    });

    if (result.success) {
      // Log success
      await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          contactId: contact.id,
          status: "SENT",
        },
      });
      sent++;
    } else {
      // Log failure
      await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          contactId: contact.id,
          status: "FAILED",
          error: result.error || "Unknown send error",
        },
      });
      failed++;
    }
  }

  // Update automation stats
  if (sent > 0 || failed > 0) {
    await prisma.automation.update({
      where: { id: automation.id },
      data: {
        totalSent: { increment: sent },
        lastTriggered: new Date(),
      },
    });

    // Update monthly email usage and deduct credits
    if (sent > 0) {
      await prisma.marketingConfig.update({
        where: { id: marketingConfig.id },
        data: {
          emailSentThisMonth: { increment: sent },
        },
      });

      // Deduct credits for successfully sent emails
      const emailCreditsToDeduct = emailCreditCost * sent;
      await creditService.deductCredits({
        userId: automation.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: emailCreditsToDeduct,
        description: `Automation "${automation.name}": ${sent} emails sent`,
        referenceType: "automation_email",
        referenceId: automation.id,
      });
    }
  }

  return { sent, failed, skipped };
}

// ---------------------------------------------------------------------------
// sendSmsToContacts — SMS/MMS automation sends
// ---------------------------------------------------------------------------

async function sendSmsToContacts(
  automation: {
    id: string;
    userId: string;
    content: string;
    name: string;
    totalSent: number;
    imageUrl?: string | null;
    imageSource?: string | null;
    imageOverlayText?: string | null;
  },
  contacts: ContactForSend[],
  startOfToday: Date
): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0;
  let failed = 0;
  const skipped = 0;

  if (contacts.length === 0) return { sent, failed, skipped };

  // Load SMS config
  const smsConfig = await prisma.marketingConfig.findUnique({
    where: { userId: automation.userId },
    select: {
      id: true,
      smsEnabled: true,
      smsPhoneNumber: true,
      smsComplianceStatus: true,
      smsTollfreeVerifyStatus: true,
      optOutMessage: true,
    },
  });

  if (!smsConfig?.smsEnabled || !smsConfig.smsPhoneNumber) {
    for (const contact of contacts) {
      await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          contactId: contact.id,
          status: "FAILED",
          error: "SMS not configured",
        },
      });
    }
    return { sent, failed: contacts.length, skipped };
  }

  // Check credits
  const automationIsMMS = !!automation.imageUrl || automation.imageSource === "contact_photo";
  const creditsPerMsg = automationIsMMS
    ? await getDynamicCreditCost("MMS_SEND")
    : await getDynamicCreditCost("SMS_SEND");
  const balance = await creditService.getBalance(automation.userId);
  const maxAffordable = Math.floor(balance / creditsPerMsg);
  const contactsToSend = contacts.slice(0, maxAffordable);

  // Skip unfunded contacts
  for (let i = maxAffordable; i < contacts.length; i++) {
    await prisma.automationLog.create({
      data: {
        automationId: automation.id,
        contactId: contacts[i].id,
        status: "SKIPPED",
        error: "Insufficient credits",
      },
    });
  }

  for (const contact of contactsToSend) {
    // Skip if already sent today
    const existingLog = await prisma.automationLog.findFirst({
      where: {
        automationId: automation.id,
        contactId: contact.id,
        sentAt: { gte: startOfToday },
      },
    });
    if (existingLog) continue;

    // Personalize message
    let personalizedMessage = replaceMergeTags(automation.content, contact);
    if (!personalizedMessage.toUpperCase().includes("STOP")) {
      const optOut = smsConfig.optOutMessage || "Reply STOP to unsubscribe";
      personalizedMessage += `\n\n${optOut}`;
    }

    // Determine media URL
    let contactMediaUrl: string | undefined;
    if (automation.imageSource === "contact_photo" && contact.imageUrl) {
      if (automation.imageOverlayText) {
        try {
          const personalizedOverlay = replaceMergeTags(automation.imageOverlayText, contact);
          const pngBuffer = await compositeImageWithText({
            baseImageUrl: contact.imageUrl,
            text: personalizedOverlay,
          });
          const key = `media/auto-${automation.id}-${contact.id}-${Date.now()}.png`;
          contactMediaUrl = await uploadToS3(key, pngBuffer, "image/png");
        } catch {
          contactMediaUrl = contact.imageUrl;
        }
      } else {
        contactMediaUrl = contact.imageUrl;
      }
    } else if (automation.imageUrl) {
      contactMediaUrl = automation.imageUrl;
    }

    // Send
    const result = await sendSMS({
      from: smsConfig.smsPhoneNumber!,
      to: formatPhoneNumber(contact.phone!),
      body: personalizedMessage,
      ...(contactMediaUrl ? { mediaUrl: contactMediaUrl } : {}),
    });

    if (result.success) {
      await prisma.automationLog.create({
        data: { automationId: automation.id, contactId: contact.id, status: "SENT" },
      });
      sent++;
    } else {
      await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          contactId: contact.id,
          status: "FAILED",
          error: result.error || "SMS send error",
        },
      });
      failed++;
    }
  }

  // Update automation stats + deduct credits
  if (sent > 0 || failed > 0) {
    await prisma.automation.update({
      where: { id: automation.id },
      data: { totalSent: { increment: sent }, lastTriggered: new Date() },
    });

    if (sent > 0) {
      await creditService.deductCredits({
        userId: automation.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: creditsPerMsg * sent,
        description: `${automationIsMMS ? "MMS" : "SMS"} automation "${automation.name}": ${sent} messages sent`,
        referenceType: "automation_sms",
        referenceId: automation.id,
      });
    }
  }

  return { sent, failed, skipped: skipped + Math.max(0, contacts.length - maxAffordable) };
}
