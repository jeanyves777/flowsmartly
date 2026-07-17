/**
 * Voice Agent — phone numbers, on xAI.
 *
 * GET    ?action=mine → the user's lines (+ what's answering them)
 * POST   {mode:"request"} → ask us for a line. An admin fulfils it.
 * POST   {mode:"byo"}     → register a number the business already owns. Automatic.
 * DELETE ?id=…            → give the line up.
 *
 * Why "request" is not automated: the provider REFUSES to provision its own
 * numbers over the API — "Provisioning xAI phone numbers via the API is not
 * supported. Use the console instead." So the honest design is a real request
 * state an admin clears, not a fake spinner. Bringing your own number IS
 * automatable, so that path never waits for a human.
 *
 * Nothing here blocks building an agent: an agent with no line is a DRAFT and
 * stays fully editable. Only going LIVE needs a line that can actually ring.
 */

import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { deleteXaiNumber, registerByoNumber } from "@/lib/voice-agent/xai-phone";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

const E164 = /^\+[1-9]\d{7,14}$/;

/** A long random secret for the per-number webhook + SIP credentials. */
function secret(len = 28): string {
  const abc = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) s += abc[bytes[i] % abc.length];
  return s;
}

// ── GET ──

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    if (searchParams.get("action") !== "mine") return fail("Unknown action");

    const numbers = await prisma.phoneNumber.findMany({
      where: { userId: session.userId, status: { not: "RELEASED" } },
      orderBy: { createdAt: "asc" },
      include: { agent: { select: { id: true, name: true, status: true } } },
    });

    return NextResponse.json({ success: true, numbers });
  } catch (error) {
    console.error("[VoiceAgent/numbers] GET error:", error);
    return fail("Could not load your numbers", 500);
  }
}

// ── POST ──

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const body = await request.json();
    const mode: "request" | "byo" = body.mode === "byo" ? "byo" : "request";

    // --- Ask us for a line. An admin provisions it; we never fake it. ---
    if (mode === "request") {
      const pending = await prisma.phoneNumber.findFirst({
        where: { userId: session.userId, status: "REQUESTED" },
      });
      if (pending) {
        return NextResponse.json({ success: true, number: pending, alreadyRequested: true });
      }

      const number = await prisma.phoneNumber.create({
        data: {
          userId: session.userId,
          origin: "XAI_PROVISIONED",
          status: "REQUESTED",
          country: (body.country || "US").toUpperCase(),
          requestedAreaCode: (body.areaCode || "").replace(/\D/g, "").slice(0, 4) || null,
          requestNote: (body.note || "").slice(0, 300) || null,
          requestedAt: new Date(),
        },
        include: { agent: { select: { id: true, name: true, status: true } } },
      });

      return NextResponse.json({ success: true, number });
    }

    // --- Register a number they already own. No human in the loop. ---
    const phoneNumber: string = (body.phoneNumber || "").trim();
    if (!E164.test(phoneNumber)) {
      return fail("Enter your number in full international format, like +14155550142.");
    }

    const clash = await prisma.phoneNumber.findUnique({ where: { e164: phoneNumber } });
    if (clash && clash.status !== "RELEASED") {
      return fail(
        clash.userId === session.userId
          ? "That number is already set up here."
          : "That number is already in use.",
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const authToken = secret(32);
    const sipUsername = `fs${secret(10).toLowerCase()}`;
    const sipPassword = secret(24);

    const reg = await registerByoNumber({
      phoneNumber,
      name: `flowsmartly-${session.userId.slice(-8)}`,
      webhookUrl: `${appUrl.replace(/\/$/, "")}/api/voice-agent/webhook/incoming`,
      webhookAuthToken: authToken,
      sipUsername,
      sipPassword,
    });

    if (!reg.ok) {
      if (reg.alreadyRegistered) {
        return fail("That number is already connected somewhere else. Disconnect it there first.");
      }
      return fail(reg.error || "Could not connect that number", 502);
    }

    // The signing secret comes back ONCE — persist it now or inbound calls can
    // never be verified and the number must be deleted and re-registered.
    const number = await prisma.phoneNumber.upsert({
      where: { e164: phoneNumber },
      create: {
        userId: session.userId,
        e164: phoneNumber,
        origin: "BYO_TRUNK",
        status: "ACTIVE",
        country: (body.country || "US").toUpperCase(),
        xaiPhoneNumberId: reg.number.phoneNumberId,
        sipHost: reg.number.sipHost ?? null,
        signingSecret: reg.number.dispatchSigningSecret ?? null,
        fulfilledAt: new Date(),
      },
      update: {
        userId: session.userId,
        status: "ACTIVE",
        origin: "BYO_TRUNK",
        xaiPhoneNumberId: reg.number.phoneNumberId,
        sipHost: reg.number.sipHost ?? null,
        signingSecret: reg.number.dispatchSigningSecret ?? null,
        releasedAt: null,
      },
      include: { agent: { select: { id: true, name: true, status: true } } },
    });

    // Their carrier needs these to point a trunk at us. sipPassword is shown
    // once, on purpose — we don't store it, and it's theirs to configure.
    return NextResponse.json({
      success: true,
      number,
      sip: { host: reg.number.sipHost, username: sipUsername, password: sipPassword },
    });
  } catch (error) {
    console.error("[VoiceAgent/numbers] POST error:", error);
    return fail("Could not set that number up", 500);
  }
}

// ── DELETE ──

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return fail("Which number?");

    const number = await prisma.phoneNumber.findFirst({ where: { id, userId: session.userId } });
    if (!number) return fail("Number not found", 404);

    // A request that was never fulfilled is just a row — drop it.
    if (number.status === "REQUESTED") {
      await prisma.phoneNumber.delete({ where: { id } });
      return NextResponse.json({ success: true, released: true });
    }

    if (number.xaiPhoneNumberId) {
      const r = await deleteXaiNumber(number.xaiPhoneNumberId);
      // Don't strand the user on a provider error — mark it released either way
      // and let an admin reconcile, rather than leaving a dead line they can't
      // remove from their own account.
      if (!r.ok) console.error("[VoiceAgent/numbers] provider delete failed:", r.error);
    }

    await prisma.phoneNumber.update({
      where: { id },
      data: { status: "RELEASED", releasedAt: new Date(), signingSecret: null },
    });

    return NextResponse.json({ success: true, released: true });
  } catch (error) {
    console.error("[VoiceAgent/numbers] DELETE error:", error);
    return fail("Could not remove that number", 500);
  }
}
