import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import {
  sendSMS,
  sendBulkSMS,
  isValidPhoneNumber,
  formatPhoneNumber,
  SMS_COST,
  MMS_COST,
} from "@/lib/twilio";

// POST /api/sms/send - Send SMS from user's rented number
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const gate = await checkPlanAccess(session.user.plan, "SMS messaging", session.userId);
    if (gate) return gate;

    const body = await request.json();
    const { to, body: messageBody, mediaUrl, recipients } = body;

    // Get user's phone number
    const settings = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
      select: {
        smsEnabled: true,
        smsPhoneNumber: true,
        smsPhoneNumberSid: true,
        smsPricePerSend: true,
        smsMonthlyLimit: true,
      },
    });

    if (!settings?.smsEnabled || !settings.smsPhoneNumber) {
      return NextResponse.json(
        { success: false, error: { message: "SMS is not enabled. Please rent a phone number first." } },
        { status: 400 }
      );
    }

    // Determine if bulk send or single send
    const isBulk = Array.isArray(recipients) && recipients.length > 0;
    const isMMS = !!mediaUrl;

    // Calculate cost per message (dynamic from admin-controlled pricing)
    const costPerMessageCredits = isMMS
      ? await getDynamicCreditCost("MMS_SEND")
      : await getDynamicCreditCost("SMS_SEND");

    if (isBulk) {
      // Bulk SMS
      if (recipients.length > 1000) {
        return NextResponse.json(
          { success: false, error: { message: "Maximum 1000 recipients per request" } },
          { status: 400 }
        );
      }

      // Validate and format recipients
      const validRecipients: { to: string; body: string; mediaUrl?: string }[] = [];
      const invalidNumbers: string[] = [];

      for (const recipient of recipients) {
        const recipientTo = recipient.to || recipient.phone || recipient.phoneNumber;
        const recipientBody = recipient.body || recipient.message || messageBody;

        if (!recipientTo || !recipientBody) {
          continue;
        }

        const formattedNumber = formatPhoneNumber(recipientTo);
        if (!isValidPhoneNumber(formattedNumber)) {
          invalidNumbers.push(recipientTo);
          continue;
        }

        validRecipients.push({
          to: formattedNumber,
          body: recipientBody,
          mediaUrl: recipient.mediaUrl || mediaUrl,
        });
      }

      if (validRecipients.length === 0) {
        return NextResponse.json(
          { success: false, error: { message: "No valid recipients found" } },
          { status: 400 }
        );
      }

      // Check credit balance
      const totalCreditsNeeded = costPerMessageCredits * validRecipients.length;
      const balance = await creditService.getBalance(session.userId);

      if (balance < totalCreditsNeeded) {
        return NextResponse.json(
          { success: false, error: { message: `Insufficient credits. You need ${totalCreditsNeeded} credits to send ${validRecipients.length} messages.` } },
          { status: 400 }
        );
      }

      // Send bulk SMS
      const result = await sendBulkSMS(settings.smsPhoneNumber, validRecipients);

      // Deduct credits for successful sends
      if (result.sent > 0) {
        const creditsToDeduct = costPerMessageCredits * result.sent;
        await creditService.deductCredits({
          userId: session.userId,
          type: TRANSACTION_TYPES.USAGE,
          amount: creditsToDeduct,
          description: `SMS campaign: ${result.sent} messages sent`,
          referenceType: "sms_bulk",
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          sent: result.sent,
          failed: result.failed,
          invalidNumbers,
          totalCostCents: result.totalCostCents,
          creditsDeducted: costPerMessageCredits * result.sent,
        },
      });
    } else {
      // Single SMS
      if (!to) {
        return NextResponse.json(
          { success: false, error: { message: "Recipient phone number is required" } },
          { status: 400 }
        );
      }

      if (!messageBody) {
        return NextResponse.json(
          { success: false, error: { message: "Message body is required" } },
          { status: 400 }
        );
      }

      const formattedTo = formatPhoneNumber(to);
      if (!isValidPhoneNumber(formattedTo)) {
        return NextResponse.json(
          { success: false, error: { message: "Invalid phone number format. Use E.164 format (e.g., +1234567890)" } },
          { status: 400 }
        );
      }

      // Check credit balance
      const balance = await creditService.getBalance(session.userId);
      if (balance < costPerMessageCredits) {
        return NextResponse.json(
          { success: false, error: { message: `Insufficient credits. You need ${costPerMessageCredits} credits to send this message.` } },
          { status: 400 }
        );
      }

      // Send SMS
      const result = await sendSMS({
        from: settings.smsPhoneNumber,
        to: formattedTo,
        body: messageBody,
        mediaUrl,
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: { message: result.error } },
          { status: 500 }
        );
      }

      // Deduct credits (using dynamic pricing)
      const creditsToDeduct = costPerMessageCredits;
      await creditService.deductCredits({
        userId: session.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: creditsToDeduct,
        description: `SMS sent to ${formattedTo}`,
        referenceType: "sms_single",
        referenceId: result.messageId,
      });

      return NextResponse.json({
        success: true,
        data: {
          messageId: result.messageId,
          segments: result.segments,
          costCents: result.costCents,
          creditsDeducted: creditsToDeduct,
        },
      });
    }
  } catch (error) {
    console.error("Send SMS error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to send SMS" } },
      { status: 500 }
    );
  }
}

// GET /api/sms/send - Get SMS pricing info
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Get dynamic credit costs from admin-controlled pricing
    const smsCreditCost = await getDynamicCreditCost("SMS_SEND");
    const mmsCreditCost = await getDynamicCreditCost("MMS_SEND");

    return NextResponse.json({
      success: true,
      data: {
        pricing: {
          sms: {
            costCents: SMS_COST.total,
            breakdown: SMS_COST,
            creditsPerMessage: smsCreditCost,
          },
          mms: {
            costCents: MMS_COST.total,
            breakdown: MMS_COST,
            creditsPerMessage: mmsCreditCost,
          },
        },
      },
    });
  } catch (error) {
    console.error("Get SMS pricing error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to get pricing" } },
      { status: 500 }
    );
  }
}
