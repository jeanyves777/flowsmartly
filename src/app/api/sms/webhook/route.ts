import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { twilioClient } from "@/lib/twilio";

export const runtime = "nodejs";

// Twilio sends form-encoded data
async function parseFormData(request: NextRequest): Promise<Record<string, string>> {
  const text = await request.text();
  const params = new URLSearchParams(text);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// POST /api/sms/webhook - Handle incoming SMS from Twilio
export async function POST(request: NextRequest) {
  try {
    const data = await parseFormData(request);

    const from = data.From; // The sender's phone number
    const to = data.To; // Our Twilio number
    const body = (data.Body || "").trim().toUpperCase();

    if (!from || !to) {
      return new NextResponse(
        '<Response><Message>Invalid request</Message></Response>',
        { status: 400, headers: { "Content-Type": "text/xml" } }
      );
    }

    console.log(`[SMS Webhook] From: ${from}, To: ${to}, Body: "${body}"`);

    // Find the marketing config that owns this phone number
    const config = await prisma.marketingConfig.findFirst({
      where: { smsPhoneNumber: to },
      select: { userId: true },
    });

    if (!config) {
      console.warn(`[SMS Webhook] No config found for number ${to}`);
      return twimlResponse("");
    }

    // Handle opt-out keywords
    const STOP_KEYWORDS = ["STOP", "UNSUBSCRIBE", "END", "QUIT", "CANCEL"];
    const START_KEYWORDS = ["START", "UNSTOP", "YES", "SUBSCRIBE"];
    const HELP_KEYWORDS = ["HELP", "INFO"];

    if (STOP_KEYWORDS.includes(body)) {
      // Opt out the contact
      const contact = await prisma.contact.findFirst({
        where: {
          userId: config.userId,
          phone: from,
          smsOptedIn: true,
        },
      });

      if (contact) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            smsOptedIn: false,
            unsubscribedAt: new Date(),
          },
        });
        console.log(`[SMS Webhook] Contact ${contact.id} opted out of SMS`);
      }

      return twimlResponse(
        "You have been unsubscribed and will no longer receive messages. Reply START to resubscribe."
      );
    }

    if (START_KEYWORDS.includes(body)) {
      // Opt back in
      const contact = await prisma.contact.findFirst({
        where: {
          userId: config.userId,
          phone: from,
          smsOptedIn: false,
        },
      });

      if (contact) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            smsOptedIn: true,
            smsOptedInAt: new Date(),
            unsubscribedAt: null,
          },
        });
        console.log(`[SMS Webhook] Contact ${contact.id} opted back in to SMS`);
      }

      return twimlResponse(
        "You have been resubscribed. Reply STOP at any time to unsubscribe."
      );
    }

    if (HELP_KEYWORDS.includes(body)) {
      return twimlResponse(
        "FlowSmartly SMS: Reply STOP to unsubscribe, START to resubscribe. For support, email support@flowsmartly.com. Msg&data rates may apply."
      );
    }

    // For any other message, no auto-reply
    return twimlResponse("");
  } catch (error) {
    console.error("[SMS Webhook] Error:", error);
    return twimlResponse("");
  }
}

// Return TwiML response
function twimlResponse(message: string): NextResponse {
  const xml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
