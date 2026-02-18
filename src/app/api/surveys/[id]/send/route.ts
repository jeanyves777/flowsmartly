import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import {
  sendMarketingEmail,
  validateEmailConfig,
} from "@/lib/email/marketing-sender";
import { sendSMS, formatPhoneNumber } from "@/lib/twilio";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST /api/surveys/[id]/send — Send survey via email or SMS
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const survey = await prisma.survey.findFirst({
      where: { id, userId: session.userId },
      include: { contactList: { select: { id: true, name: true } } },
    });

    if (!survey) {
      return NextResponse.json({ success: false, error: { message: "Survey not found" } }, { status: 404 });
    }

    if (survey.status === "CLOSED") {
      return NextResponse.json({ success: false, error: { message: "Cannot send a closed survey" } }, { status: 400 });
    }

    const body = await request.json();
    const { channel, contactListId } = body as { channel: "email" | "sms"; contactListId?: string };

    if (!channel || !["email", "sms"].includes(channel)) {
      return NextResponse.json({ success: false, error: { message: "Channel must be 'email' or 'sms'" } }, { status: 400 });
    }

    // Use provided contactListId or the one linked to the survey
    const targetListId = contactListId || survey.contactListId;
    if (!targetListId) {
      return NextResponse.json({ success: false, error: { message: "No contact list specified. Link a contact list to this survey or provide one." } }, { status: 400 });
    }

    // Verify list ownership
    const list = await prisma.contactList.findFirst({
      where: { id: targetListId, userId: session.userId },
      select: { id: true, name: true },
    });
    if (!list) {
      return NextResponse.json({ success: false, error: { message: "Contact list not found" } }, { status: 404 });
    }

    // Get contacts from the list
    const members = await prisma.contactListMember.findMany({
      where: { contactListId: targetListId },
      include: {
        contact: {
          select: {
            id: true, email: true, phone: true,
            firstName: true, lastName: true,
            status: true, emailOptedIn: true, smsOptedIn: true,
          },
        },
      },
    });

    // Filter active contacts with proper opt-in
    const validContacts = members.filter((m) => {
      if (m.contact.status !== "ACTIVE") return false;
      if (channel === "email" && (!m.contact.email || !m.contact.emailOptedIn)) return false;
      if (channel === "sms" && (!m.contact.phone || !m.contact.smsOptedIn)) return false;
      return true;
    });

    if (validContacts.length === 0) {
      return NextResponse.json({ success: false, error: { message: `No valid contacts with ${channel === "email" ? "email opt-in" : "SMS opt-in"} found in this list` } }, { status: 400 });
    }

    const surveyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com"}/survey/${survey.slug}`;

    // ── EMAIL CHANNEL ──
    if (channel === "email") {
      const marketingConfig = await prisma.marketingConfig.findUnique({
        where: { userId: session.userId },
        select: {
          id: true, emailProvider: true, emailConfig: true,
          emailEnabled: true, emailVerified: true,
          defaultFromName: true, defaultFromEmail: true, defaultReplyTo: true,
          emailMonthlyLimit: true, emailSentThisMonth: true,
        },
      });

      if (!marketingConfig || (!marketingConfig.emailEnabled && !marketingConfig.emailVerified)) {
        return NextResponse.json({ success: false, error: { message: "Email marketing is not configured. Go to Settings > Marketing to set up your email provider." } }, { status: 400 });
      }

      let emailConfig: Record<string, unknown>;
      try {
        emailConfig = JSON.parse(marketingConfig.emailConfig);
      } catch {
        return NextResponse.json({ success: false, error: { message: "Invalid email configuration." } }, { status: 400 });
      }

      const validationError = validateEmailConfig(marketingConfig.emailProvider, emailConfig);
      if (validationError) {
        return NextResponse.json({ success: false, error: { message: validationError } }, { status: 400 });
      }

      const fromEmail = (emailConfig.fromEmail as string) || marketingConfig.defaultFromEmail || "";
      if (!fromEmail) {
        return NextResponse.json({ success: false, error: { message: "No from email address configured." } }, { status: 400 });
      }
      const fromName = marketingConfig.defaultFromName || "";
      const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

      // Check monthly limit
      const remaining = marketingConfig.emailMonthlyLimit - marketingConfig.emailSentThisMonth;
      if (remaining < validContacts.length) {
        return NextResponse.json({ success: false, error: { message: `Monthly email limit would be exceeded. ${remaining} emails remaining, need ${validContacts.length}.` } }, { status: 400 });
      }

      // Check credits
      const emailCreditCost = await getDynamicCreditCost("EMAIL_SEND");
      const totalCost = emailCreditCost * validContacts.length;
      const balance = await creditService.getBalance(session.userId);
      if (balance < totalCost) {
        return NextResponse.json({ success: false, error: { message: `Insufficient credits. Need ${totalCost}, have ${balance}.` } }, { status: 402 });
      }

      // Send in background (fire-and-forget)
      const userId = session.userId;
      const surveyId = id;
      (async () => {
        let sent = 0;
        for (let i = 0; i < validContacts.length; i += BATCH_SIZE) {
          const batch = validContacts.slice(i, i + BATCH_SIZE);
          await Promise.allSettled(
            batch.map(async (m) => {
              const name = [m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "there";
              const html = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>${survey.title}</h2>
                  ${survey.description ? `<p style="color: #666;">${survey.description}</p>` : ""}
                  <p>Hi ${name},</p>
                  <p>We'd love to hear your feedback! Please take a moment to fill out our survey.</p>
                  <p style="text-align: center; margin: 24px 0;">
                    <a href="${surveyUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Take Survey</a>
                  </p>
                  <p style="color: #999; font-size: 12px;">If the button doesn't work, copy this link: ${surveyUrl}</p>
                </div>
              `;

              const result = await sendMarketingEmail({
                provider: marketingConfig!.emailProvider,
                emailConfig,
                from: fromAddress,
                to: m.contact.email!,
                subject: survey.title,
                html,
                replyTo: marketingConfig!.defaultReplyTo || undefined,
              });

              if (result.success) {
                sent++;
                await creditService.deductCredits({
                  userId,
                  type: TRANSACTION_TYPES.USAGE,
                  amount: emailCreditCost,
                  description: `Survey email: ${survey.title}`,
                  referenceType: "survey",
                  referenceId: surveyId,
                });
              }
            })
          );
          if (i + BATCH_SIZE < validContacts.length) await sleep(BATCH_DELAY_MS);
        }

        // Update survey stats and email count
        await prisma.survey.update({
          where: { id: surveyId },
          data: { sendCount: { increment: sent }, lastSentAt: new Date(), status: "ACTIVE", isActive: true },
        });
        await prisma.marketingConfig.update({
          where: { id: marketingConfig!.id },
          data: { emailSentThisMonth: { increment: sent } },
        });
      })();

      return NextResponse.json({
        success: true,
        data: { message: `Sending survey to ${validContacts.length} contacts via email`, channel: "email", recipients: validContacts.length },
      });
    }

    // ── SMS CHANNEL ──
    if (channel === "sms") {
      // Get user's SMS config from MarketingConfig
      const smsConfig = await prisma.marketingConfig.findUnique({
        where: { userId: session.userId },
        select: { smsPhoneNumber: true, smsEnabled: true, smsComplianceStatus: true },
      });

      if (!smsConfig || !smsConfig.smsEnabled || !smsConfig.smsPhoneNumber) {
        return NextResponse.json({ success: false, error: { message: "SMS is not configured. Go to Settings > SMS to set up your phone number." } }, { status: 400 });
      }

      if (smsConfig.smsComplianceStatus !== "APPROVED") {
        return NextResponse.json({ success: false, error: { message: "SMS sending requires compliance approval. Check your SMS settings." } }, { status: 400 });
      }

      // Check credits
      const smsCreditCost = await getDynamicCreditCost("SMS_SEND");
      const totalCost = smsCreditCost * validContacts.length;
      const balance = await creditService.getBalance(session.userId);
      if (balance < totalCost) {
        return NextResponse.json({ success: false, error: { message: `Insufficient credits. Need ${totalCost}, have ${balance}.` } }, { status: 402 });
      }

      // Send in background (fire-and-forget)
      const userId = session.userId;
      const surveyId = id;
      const fromNumber = smsConfig.smsPhoneNumber!;
      (async () => {
        let sent = 0;
        for (let i = 0; i < validContacts.length; i += BATCH_SIZE) {
          const batch = validContacts.slice(i, i + BATCH_SIZE);
          await Promise.allSettled(
            batch.map(async (m) => {
              const result = await sendSMS({
                from: fromNumber,
                to: formatPhoneNumber(m.contact.phone!),
                body: `${survey.title}\n\nWe'd love your feedback! Take our quick survey: ${surveyUrl}\n\nReply STOP to opt out`,
              });

              if (result.success) {
                sent++;
                await creditService.deductCredits({
                  userId,
                  type: TRANSACTION_TYPES.USAGE,
                  amount: smsCreditCost,
                  description: `Survey SMS: ${survey.title}`,
                  referenceType: "survey",
                  referenceId: surveyId,
                });
              }
            })
          );
          if (i + BATCH_SIZE < validContacts.length) await sleep(BATCH_DELAY_MS);
        }

        await prisma.survey.update({
          where: { id: surveyId },
          data: { sendCount: { increment: sent }, lastSentAt: new Date(), status: "ACTIVE", isActive: true },
        });
      })();

      return NextResponse.json({
        success: true,
        data: { message: `Sending survey to ${validContacts.length} contacts via SMS`, channel: "sms", recipients: validContacts.length },
      });
    }

    return NextResponse.json({ success: false, error: { message: "Invalid channel" } }, { status: 400 });
  } catch (error) {
    console.error("Send survey error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to send survey" } }, { status: 500 });
  }
}
