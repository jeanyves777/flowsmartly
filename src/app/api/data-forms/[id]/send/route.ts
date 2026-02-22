import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { getUserBrand } from "@/lib/brand/get-brand";
import { buildEmailHtml, EmailBrandInfo } from "@/lib/marketing/templates/email-html";
import { sendMarketingEmail, validateEmailConfig } from "@/lib/email/marketing-sender";
import { sendSMS, formatPhoneNumber } from "@/lib/twilio";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST /api/data-forms/[id]/send — Send data form via email or SMS
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;

    const dataForm = await prisma.dataForm.findFirst({
      where: { id, userId: session.userId },
      include: { contactList: { select: { id: true, name: true } } },
    });

    if (!dataForm) {
      return NextResponse.json({ success: false, error: { message: "Form not found" } }, { status: 404 });
    }

    if (dataForm.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: { message: "Form must be active to send. Change the status to Active first." } }, { status: 400 });
    }

    const body = await request.json();
    const { channel, contactListId } = body as { channel: "email" | "sms"; contactListId?: string };

    if (!channel || !["email", "sms"].includes(channel)) {
      return NextResponse.json({ success: false, error: { message: "Channel must be 'email' or 'sms'" } }, { status: 400 });
    }

    const targetListId = contactListId || dataForm.contactListId;
    if (!targetListId) {
      return NextResponse.json({ success: false, error: { message: "No contact list specified. Link a contact list to this form or provide one." } }, { status: 400 });
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

    const formUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com"}/form/${dataForm.slug}`;

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
      const formId = id;
      (async () => {
        let sent = 0;
        for (let i = 0; i < validContacts.length; i += BATCH_SIZE) {
          const batch = validContacts.slice(i, i + BATCH_SIZE);
          await Promise.allSettled(
            batch.map(async (m) => {
              const name = [m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "there";
              const html = buildEmailHtml(
                [
                  { type: "heading", content: dataForm.title },
                  ...(dataForm.description ? [{ type: "text" as const, content: dataForm.description }] : []),
                  { type: "text", content: `Hi ${name},` },
                  { type: "text", content: "Please take a moment to fill out this form." },
                  { type: "button", content: "Fill Out Form", href: formUrl },
                  { type: "text", content: `<span style="color: #999; font-size: 12px;">If the button doesn\u2019t work, copy this link: ${formUrl}</span>` },
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
                subject: dataForm.title,
                html,
                replyTo: marketingConfig!.defaultReplyTo || undefined,
              });

              if (result.success) {
                sent++;
                await creditService.deductCredits({
                  userId,
                  type: TRANSACTION_TYPES.USAGE,
                  amount: emailCreditCost,
                  description: `Form email: ${dataForm.title}`,
                  referenceType: "data-form",
                  referenceId: formId,
                });
              }
            })
          );
          if (i + BATCH_SIZE < validContacts.length) await sleep(BATCH_DELAY_MS);
        }

        await prisma.dataForm.update({
          where: { id: formId },
          data: { sendCount: { increment: sent }, lastSentAt: new Date() },
        });
        await prisma.marketingConfig.update({
          where: { id: marketingConfig!.id },
          data: { emailSentThisMonth: { increment: sent } },
        });
      })();

      return NextResponse.json({
        success: true,
        data: { message: `Sending form to ${validContacts.length} contacts via email`, channel: "email", recipients: validContacts.length },
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
      const formId = id;
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
                body: `[${businessName}] ${dataForm.title}\n\nPlease fill out this form: ${formUrl}\n\nReply STOP to opt out`,
              });

              if (result.success) {
                sent++;
                await creditService.deductCredits({
                  userId,
                  type: TRANSACTION_TYPES.USAGE,
                  amount: smsCreditCost,
                  description: `Form SMS: ${dataForm.title}`,
                  referenceType: "data-form",
                  referenceId: formId,
                });
              }
            })
          );
          if (i + BATCH_SIZE < validContacts.length) await sleep(BATCH_DELAY_MS);
        }

        await prisma.dataForm.update({
          where: { id: formId },
          data: { sendCount: { increment: sent }, lastSentAt: new Date() },
        });
      })();

      return NextResponse.json({
        success: true,
        data: { message: `Sending form to ${validContacts.length} contacts via SMS`, channel: "sms", recipients: validContacts.length },
      });
    }

    return NextResponse.json({ success: false, error: { message: "Invalid channel" } }, { status: 400 });
  } catch (error) {
    console.error("Send data form error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to send form" } }, { status: 500 });
  }
}
