/**
 * Admin — connect a client's own number by Direct SIP (BYO trunk).
 *
 * The client provides a number they already own; it lands here as a REQUESTED
 * BYO line. One click runs the real xAI registration (`registerByoNumber`), which
 * is the API equivalent of filling the console's "Direct SIP" modal: it generates
 * the SIP credentials + webhook token, hands back the SIP host + a one-time dispatch
 * signing secret, and we persist all of it. The admin then relays the SIP URI +
 * credentials to the client's carrier so their trunk points at us.
 *
 * We never provision numbers (the provider refuses that over the API). GET lists the
 * pending client-provided numbers; POST connects one.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin/auth";
import { auditAdmin } from "@/lib/audit/logger";
import { prisma } from "@/lib/db/client";
import { registerByoNumber } from "@/lib/voice-agent/xai-phone";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

/** A long random secret for the per-number webhook + SIP credentials. */
function secret(len = 28): string {
  const abc = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) s += abc[bytes[i] % abc.length];
  return s;
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return fail("Unauthorized", 401);

  try {
    const requests = await prisma.phoneNumber.findMany({
      where: { status: "REQUESTED", origin: "BYO_TRUNK" },
      orderBy: { requestedAt: "asc" },
      select: {
        id: true, e164: true, country: true, friendlyName: true, requestNote: true, requestedAt: true,
        user: { select: { id: true, email: true, name: true } },
        agent: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error("[admin/voice-numbers] GET error:", error);
    return fail("Could not load number requests", 500);
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return fail("Unauthorized", 401);

  try {
    const { requestId } = (await request.json()) as { requestId?: string };
    if (!requestId) return fail("Which request?");

    const req = await prisma.phoneNumber.findUnique({ where: { id: requestId } });
    if (!req) return fail("Request not found", 404);
    if (req.status !== "REQUESTED") return fail("That request is already handled.");
    if (!req.e164) return fail("That request has no number to connect.");

    // Never connect the same line for two tenants.
    const clash = await prisma.phoneNumber.findFirst({
      where: { e164: req.e164, status: { not: "RELEASED" }, NOT: { id: requestId } },
    });
    if (clash) return fail("That number is already connected for someone else.");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const authToken = secret(32);
    const sipUsername = `fs${secret(10).toLowerCase()}`;
    const sipPassword = secret(24);

    const reg = await registerByoNumber({
      phoneNumber: req.e164,
      name: `flowsmartly-${req.userId.slice(-8)}`,
      webhookUrl: `${appUrl.replace(/\/$/, "")}/api/voice-agent/webhook/incoming`,
      webhookAuthToken: authToken,
      sipUsername,
      sipPassword,
    });

    if (!reg.ok) {
      if (reg.alreadyRegistered) {
        return fail("That number is already registered at the provider — disconnect it there first.");
      }
      return fail(reg.error || "Could not connect that number", 502);
    }

    // The signing secret comes back ONCE — persist it (and the SIP creds) now, or
    // inbound calls can never be verified and the number must be re-registered.
    const number = await prisma.phoneNumber.update({
      where: { id: requestId },
      data: {
        status: "ACTIVE",
        origin: "BYO_TRUNK",
        xaiPhoneNumberId: reg.number.phoneNumberId,
        sipHost: reg.number.sipHost ?? null,
        signingSecret: reg.number.dispatchSigningSecret ?? null,
        sipUsername,
        sipPassword,
        webhookAuthToken: authToken,
        fulfilledAt: new Date(),
        fulfilledBy: admin.adminId,
      },
      include: { user: { select: { email: true } } },
    });

    await auditAdmin("voice_number.connect", admin.adminId, "PhoneNumber", number.id, {
      e164: req.e164,
      xaiPhoneNumberId: reg.number.phoneNumberId,
      tenant: number.user?.email,
    });

    const host = reg.number.sipHost || "sip.voice.x.ai";
    return NextResponse.json({
      success: true,
      number: { id: number.id, e164: number.e164, status: number.status },
      // For the admin to relay to the client's carrier/PBX.
      sip: {
        host: reg.number.sipHost,
        uri: `sip:${req.e164}@${host};transport=tls`,
        username: sipUsername,
        password: sipPassword,
      },
    });
  } catch (error) {
    console.error("[admin/voice-numbers] POST error:", error);
    return fail("Could not connect that number", 500);
  }
}
