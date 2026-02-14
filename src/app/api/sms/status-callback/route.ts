import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";

/**
 * POST /api/sms/status-callback
 *
 * Twilio calls this URL with delivery status updates for each message.
 * Twilio sends form-encoded data with fields like:
 *   MessageSid, MessageStatus, ErrorCode, ErrorMessage, To, From, etc.
 *
 * Twilio message statuses flow:
 *   queued → sending → sent → delivered  (success)
 *   queued → sending → sent → undelivered (carrier rejected)
 *   queued → failed (Twilio error)
 *
 * We update CampaignSend records and recalculate Campaign aggregate counts.
 */
export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const data: Record<string, string> = {};
    params.forEach((value, key) => {
      data[key] = value;
    });

    const messageSid = data.MessageSid;
    const messageStatus = data.MessageStatus; // queued, sending, sent, delivered, undelivered, failed
    const errorCode = data.ErrorCode || null;
    const errorMessage = data.ErrorMessage || null;

    if (!messageSid || !messageStatus) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    console.log(
      `[SMS Status] ${messageSid}: ${messageStatus}${errorCode ? ` (error ${errorCode}: ${errorMessage})` : ""}`
    );

    // Only process terminal statuses — skip intermediate ones (queued, sending, sent)
    // "sent" means Twilio sent to carrier but doesn't confirm delivery yet
    // "delivered" = carrier confirmed delivery
    // "undelivered" = carrier rejected (e.g. A2P not registered, invalid number)
    // "failed" = Twilio couldn't send at all
    const terminalStatuses = ["delivered", "undelivered", "failed"];
    if (!terminalStatuses.includes(messageStatus)) {
      // Acknowledge but don't process intermediate statuses
      return new NextResponse("OK", { status: 200 });
    }

    // Find the CampaignSend record by messageId (Twilio SID)
    const sendRecord = await prisma.campaignSend.findFirst({
      where: { messageId: messageSid },
      select: {
        id: true,
        campaignId: true,
        status: true,
      },
    });

    if (!sendRecord) {
      // Could be an automation message or non-campaign SMS — ignore
      console.log(`[SMS Status] No CampaignSend found for ${messageSid}`);
      return new NextResponse("OK", { status: 200 });
    }

    // Don't re-process if already in a terminal state
    if (["DELIVERED", "FAILED", "UNDELIVERED"].includes(sendRecord.status)) {
      return new NextResponse("OK", { status: 200 });
    }

    // Map Twilio status to our status
    const now = new Date();
    let newStatus: string;
    let updateData: Record<string, unknown>;

    switch (messageStatus) {
      case "delivered":
        newStatus = "DELIVERED";
        updateData = {
          status: "DELIVERED",
          deliveredAt: now,
          failureReason: null,
        };
        break;

      case "undelivered":
        newStatus = "UNDELIVERED";
        updateData = {
          status: "UNDELIVERED",
          deliveredAt: null,
          failureReason: errorCode
            ? `Error ${errorCode}: ${errorMessage || "Message undelivered by carrier"}`
            : "Message undelivered by carrier",
        };
        break;

      case "failed":
        newStatus = "FAILED";
        updateData = {
          status: "FAILED",
          deliveredAt: null,
          failureReason: errorCode
            ? `Error ${errorCode}: ${errorMessage || "Message failed to send"}`
            : "Message failed to send",
        };
        break;

      default:
        return new NextResponse("OK", { status: 200 });
    }

    // Update the individual send record
    await prisma.campaignSend.update({
      where: { id: sendRecord.id },
      data: updateData,
    });

    // Recalculate campaign aggregate counts from actual send records
    const campaignId = sendRecord.campaignId;
    const [deliveredCount, failedCount] = await Promise.all([
      prisma.campaignSend.count({
        where: { campaignId, status: "DELIVERED" },
      }),
      prisma.campaignSend.count({
        where: {
          campaignId,
          status: { in: ["FAILED", "UNDELIVERED"] },
        },
      }),
    ]);

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        deliveredCount,
        failedCount,
      },
    });

    console.log(
      `[SMS Status] Updated campaign ${campaignId}: delivered=${deliveredCount}, failed=${failedCount}`
    );

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[SMS Status Callback] Error:", error);
    // Always return 200 to Twilio to prevent retries
    return new NextResponse("OK", { status: 200 });
  }
}
