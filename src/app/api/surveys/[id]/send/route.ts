import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import {
  sendMarketingEmail,
  validateEmailConfig,
} from "@/lib/email/marketing-sender";
import { sendSMS, formatPhoneNumber } from "@/lib/telnyx/sms";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { buildEmailHtml, EmailBrandInfo } from "@/lib/marketing/templates/email-html";
import { getUserBrand } from "@/lib/brand/get-brand";

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

    const targetListId = contactListId || survey.contactListId;
    if (!targetListId) {
      return NextResponse.json({ success: false, error: { message: "No contact list specified. Link a contact list to this survey or provide one." } }, { status: 400 });
    }

    const list = await prisma.contactList.findFirst({
      where: { id: targetListId, userId: session.userId },
      select: { id: true, name: true },
    });
    if (!list) {
      return NextResponse.json({ success: false, error: { message: "Contact list not found" } }, { status: 404 });
    }

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

    // Fetch brand kit for branded emails/SMS
    const brand = await getUserBrand(session.userId);
    const primaryColor = brand?.colors?.primary || "#6366f1";
    const businessName = brand?.name || "FlowSmartly";

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
      const fromName = marketingConfig.defaultFromName || businessName;
      const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

      const remaining = marketingConfig.emailMonthlyLimit - marketingConfig.emailSentThisMonth;
      if (remaining < validContacts.length) {
        return NextResponse.json({ success: false, error: { message: `Monthly email limit would be exceeded. ${remaining} emails remaining, need ${validContacts.length}.` } }, { status: 400 });
      }

      const emailCreditCost = await getDynamicCreditCost("EMAIL_SEND");
      const totalCost = emailCreditCost * validContacts.length;
      const balance = await creditService.getBalance(session.userId);
      if (balance < totalCost) {
        return NextResponse.json({ success: false, error: { message: `Insufficient credits. Need ${totalCost}, have ${balance}.` } }, { status: 402 });
      }

      // Build brand info for email template
      const brandInfo: EmailBrandInfo | undefined = brand
        ? {
            name: brand.name,
            logo: brand.logo || undefined,
            website: brand.website || undefined,
            email: brand.email || undefined,
            phone: brand.phone || undefined,
            address: brand.address || undefined,
            socials: brand.handles || undefined,
          }
        : undefined;

      const userId = session.userId;
      const surveyId = id;
      void (async () => {
       try {
        let sent = 0;
        for (let i = 0; i < validContacts.length; i += BATCH_SIZE) {
          const batch = validContacts.slice(i, i + BATCH_SIZE);
          await Promise.allSettled(
            batch.map(async (m) => {
              const name = [m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "there";
              const html = buildEmailHtml(
                [
                  { type: "heading", content: survey.title },
                  ...(survey.description ? [{ type: "text" as const, content: survey.description }] : []),
                  { type: "text", content: `Hi ${name},` },
                  { type: "text", content: "We\u2019d love to hear your feedback! Please take a moment to fill out our survey." },
                  { type: "button", content: "Take Survey", href: surveyUrl },
                  { type: "text", content: `<span style="color: #999; font-size: 12px;">If the button doesn\u2019t work, copy this link: ${surveyUrl}</span>` },
                ],
                {
                  brandColor: primaryColor,
                  brand: brandInfo,
                }
              );

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

        await prisma.survey.update({
          where: { id: surveyId },
          data: { sendCount: { increment: sent }, lastSentAt: new Date(), status: "ACTIVE", isActive: true },
        });
        await prisma.marketingConfig.update({
          where: { id: marketingConfig!.id },
          data: { emailSentThisMonth: { increment: sent } },
        });
       } catch (err) {
         console.error("Survey email send (background) failed:", err);
       }
      })();

      // Sending happens asynchronously in batches, so we honestly report the
      // job as QUEUED rather than claiming a definitive "Sent to N".
      return NextResponse.json({
        success: true,
        data: { message: `Queued survey to ${validContacts.length} contact${validContacts.length === 1 ? "" : "s"} via email`, channel: "email", queued: validContacts.length, recipients: validContacts.length },
      });
    }

    // ── SMS CHANNEL ──
    if (channel === "sms") {
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

      const smsCreditCost = await getDynamicCreditCost("SMS_SEND");
      const totalCost = smsCreditCost * validContacts.length;
      const balance = await creditService.getBalance(session.userId);
      if (balance < totalCost) {
        return NextResponse.json({ success: false, error: { message: `Insufficient credits. Need ${totalCost}, have ${balance}.` } }, { status: 402 });
      }

      const userId = session.userId;
      const surveyId = id;
      const fromNumber = smsConfig.smsPhoneNumber!;
      void (async () => {
       try {
        let sent = 0;
        for (let i = 0; i < validContacts.length; i += BATCH_SIZE) {
          const batch = validContacts.slice(i, i + BATCH_SIZE);
          await Promise.allSettled(
            batch.map(async (m) => {
              const result = await sendSMS({
                from: fromNumber,
                to: formatPhoneNumber(m.contact.phone!),
                body: `[${businessName}] ${survey.title}\n\nWe\u2019d love your feedback! Take our quick survey: ${surveyUrl}\n\nReply STOP to opt out`,
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
       } catch (err) {
         console.error("Survey SMS send (background) failed:", err);
       }
      })();

      // Async batched send → report as QUEUED, not a definitive "Sent to N".
      return NextResponse.json({
        success: true,
        data: { message: `Queued survey to ${validContacts.length} contact${validContacts.length === 1 ? "" : "s"} via SMS`, channel: "sms", queued: validContacts.length, recipients: validContacts.length },
      });
    }

    return NextResponse.json({ success: false, error: { message: "Invalid channel" } }, { status: 400 });
  } catch (error) {
    console.error("Send survey error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to send survey" } }, { status: 500 });
  }
}
