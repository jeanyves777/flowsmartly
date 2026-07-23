import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";

/**
 * POST /api/sms/status-callback
 *
 * Per-message delivery webhook for campaign sends (passed as Telnyx
 * `webhook_url` on each outbound message). Telnyx POSTs a JSON event
 * `{ data: { event_type, payload } }`.
 *
 * Telnyx delivery flow (status lives on payload.to[].status):
 *   queued → sending → sent → delivered          (success)
 *   … → delivery_failed                          (carrier rejected)
 *   … → sending_failed                           (Telnyx couldn't send)
 *
 * We update the matching CampaignSend and recompute Campaign aggregate counts.
 */

interface TelnyxOutbound {
  id?: string;
  to?: Array<{ phone_number?: string; status?: string }>;
  errors?: Array<{ code?: string; title?: string; detail?: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const evt = (await request.json().catch(() => null)) as
      | { data?: { event_type?: string; payload?: TelnyxOutbound } }
      | null;

    const payload = evt?.data?.payload;
    if (!payload) return new NextResponse("OK", { status: 200 });

    const messageId = payload.id;
    const toEntry = Array.isArray(payload.to) ? payload.to[0] : undefined;
    const rawStatus = (toEntry?.status || "").toLowerCase();

    if (!messageId || !rawStatus) return new NextResponse("OK", { status: 200 });

    // Map Telnyx status → our terminal status. Skip intermediate states.
    let newStatus: "DELIVERED" | "UNDELIVERED" | "FAILED" | null = null;
    if (rawStatus === "delivered") newStatus = "DELIVERED";
    else if (rawStatus === "delivery_failed") newStatus = "UNDELIVERED";
    else if (rawStatus === "sending_failed") newStatus = "FAILED";

    if (!newStatus) return new NextResponse("OK", { status: 200 });

    const err = payload.errors?.[0];
    console.log(
      `[SMS Status] ${messageId}: ${rawStatus}${err ? ` (error ${err.code}: ${err.detail || err.title})` : ""}`,
    );

    const sendRecord = await prisma.campaignSend.findFirst({
      where: { messageId },
      select: { id: true, campaignId: true, status: true },
    });
    if (!sendRecord) {
      console.log(`[SMS Status] No CampaignSend found for ${messageId}`);
      return new NextResponse("OK", { status: 200 });
    }
    if (["DELIVERED", "FAILED", "UNDELIVERED"].includes(sendRecord.status)) {
      return new NextResponse("OK", { status: 200 });
    }

    const failureReason =
      newStatus === "DELIVERED"
        ? null
        : err
          ? `Error ${err.code || ""}: ${err.detail || err.title || "Message not delivered"}`.trim()
          : "Message not delivered by carrier";

    await prisma.campaignSend.update({
      where: { id: sendRecord.id },
      data: {
        status: newStatus,
        deliveredAt: newStatus === "DELIVERED" ? new Date() : null,
        failureReason,
      },
    });

    const campaignId = sendRecord.campaignId;
    const [deliveredCount, failedCount] = await Promise.all([
      prisma.campaignSend.count({ where: { campaignId, status: "DELIVERED" } }),
      prisma.campaignSend.count({ where: { campaignId, status: { in: ["FAILED", "UNDELIVERED"] } } }),
    ]);

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { deliveredCount, failedCount },
    });

    console.log(`[SMS Status] Updated campaign ${campaignId}: delivered=${deliveredCount}, failed=${failedCount}`);
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[SMS Status Callback] Error:", error);
    // Always 200 so Telnyx doesn't retry.
    return new NextResponse("OK", { status: 200 });
  }
}
