import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { sendTelnyxSms } from "@/lib/telnyx/messaging";

export const runtime = "nodejs";

/**
 * Inbound SMS webhook (Telnyx messaging-profile webhook).
 *
 * Telnyx POSTs a JSON event `{ data: { event_type, payload } }`. We act only on
 * `message.received` (inbound texts) to process STOP / START / HELP keywords.
 * Outbound status events that land here (sends without a per-message webhook)
 * are ignored — campaign delivery status is handled by /api/sms/status-callback.
 *
 * Telnyx has no TwiML: any auto-reply is sent back through the API.
 */

interface TelnyxInbound {
  from?: { phone_number?: string };
  to?: Array<{ phone_number?: string }>;
  text?: string;
}

export async function POST(request: NextRequest) {
  try {
    const evt = (await request.json().catch(() => null)) as
      | { data?: { event_type?: string; payload?: TelnyxInbound } }
      | null;

    const eventType = evt?.data?.event_type;
    const payload = evt?.data?.payload;

    // Only inbound messages are actionable here.
    if (!payload || eventType !== "message.received") {
      return NextResponse.json({ ok: true });
    }

    const from = payload.from?.phone_number; // sender
    const to = Array.isArray(payload.to) ? payload.to[0]?.phone_number : undefined; // our number
    const body = (payload.text || "").trim().toUpperCase();

    if (!from || !to) return NextResponse.json({ ok: true });

    console.log(`[SMS Webhook] From: ${from}, To: ${to}, Body: "${body}"`);

    const config = await prisma.marketingConfig.findFirst({
      where: { smsPhoneNumber: to },
      select: { userId: true },
    });
    if (!config) {
      console.warn(`[SMS Webhook] No config found for number ${to}`);
      return NextResponse.json({ ok: true });
    }

    const STOP_KEYWORDS = ["STOP", "UNSUBSCRIBE", "END", "QUIT", "CANCEL"];
    const START_KEYWORDS = ["START", "UNSTOP", "YES", "SUBSCRIBE"];
    const HELP_KEYWORDS = ["HELP", "INFO"];

    if (STOP_KEYWORDS.includes(body)) {
      const contact = await prisma.contact.findFirst({
        where: { userId: config.userId, phone: from, smsOptedIn: true },
      });
      if (contact) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { smsOptedIn: false, unsubscribedAt: new Date() },
        });
        console.log(`[SMS Webhook] Contact ${contact.id} opted out of SMS`);
      }
      await reply(to, from, "You have been unsubscribed and will no longer receive messages. Reply START to resubscribe.");
    } else if (START_KEYWORDS.includes(body)) {
      const contact = await prisma.contact.findFirst({
        where: { userId: config.userId, phone: from, smsOptedIn: false },
      });
      if (contact) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { smsOptedIn: true, smsOptedInAt: new Date(), unsubscribedAt: null },
        });
        console.log(`[SMS Webhook] Contact ${contact.id} opted back in to SMS`);
      }
      await reply(to, from, "You have been resubscribed. Reply STOP at any time to unsubscribe.");
    } else if (HELP_KEYWORDS.includes(body)) {
      await reply(
        to,
        from,
        "FlowSmartly SMS: Reply STOP to unsubscribe, START to resubscribe. For support, email info@flowsmartly.com. Msg&data rates may apply.",
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[SMS Webhook] Error:", error);
    return NextResponse.json({ ok: true });
  }
}

/** Send an auto-reply from our number back to the sender (best-effort). */
async function reply(from: string, to: string, text: string): Promise<void> {
  try {
    await sendTelnyxSms({ from, to, text });
  } catch (error) {
    // Telnyx blocks messages after a carrier-level STOP; a failed confirmation is expected.
    console.warn("[SMS Webhook] Auto-reply not delivered:", error instanceof Error ? error.message : error);
  }
}
