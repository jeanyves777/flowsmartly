/**
 * Voice Agent — phone numbers.
 *
 * GET  ?action=mine      → the user's numbers (+ what's answering them)
 * GET  ?areaCode=415…    → search numbers available to subscribe to
 * POST                   → subscribe to a number, or add voice to one they hold
 * DELETE ?id=…           → cancel (release, or just stop answering)
 *
 * Modelled on /api/sms/numbers, with three deliberate departures:
 *
 *  1. No `checkPlanAccess`. Access here is credit-gated, not tier-gated.
 *  2. No A2P/opt-in compliance gate. That's a *messaging* carrier requirement;
 *     blocking a voice number on an SMS opt-in screenshot would make the studio
 *     unusable for someone who never wants to send a text.
 *  3. Credits are taken BEFORE the number is bought, and refunded if the
 *     purchase fails. The SMS route buys first and deducts after, so a failed
 *     deduct there leaves a number rented at Twilio that nobody ever paid for.
 */

import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { prisma } from "@/lib/db/client";
import { searchAvailableNumbers, releasePhoneNumber } from "@/lib/twilio";
import {
  attachVoiceToNumber,
  detachVoiceFromNumber,
  purchaseVoiceNumber,
  VOICE_NUMBER_RENTAL_COST,
} from "@/lib/twilio/voice";

const RENT_CREDITS = VOICE_NUMBER_RENTAL_COST.total; // 1 credit = 1 cent

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

/** One month on, clamped so a late bill doesn't compound into the past. */
function nextPeriod(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

// ── GET ──

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const { searchParams } = new URL(request.url);

    if (searchParams.get("action") === "mine") {
      const numbers = await prisma.phoneNumber.findMany({
        where: { userId: session.userId, status: { not: "RELEASED" } },
        orderBy: { createdAt: "asc" },
        include: { agent: { select: { id: true, name: true, status: true } } },
      });

      // A number rented by the SMS system isn't in this table yet, but the user
      // already pays for it — surface it so "add voice to my number" is offered
      // instead of charging them a second rent for a second DID.
      const sms = await prisma.marketingConfig.findUnique({
        where: { userId: session.userId },
        select: { smsPhoneNumber: true, smsPhoneNumberSid: true },
      });

      const known = new Set(numbers.map((n) => n.e164));
      const linkable =
        sms?.smsPhoneNumber && sms.smsPhoneNumberSid && !known.has(sms.smsPhoneNumber)
          ? { e164: sms.smsPhoneNumber, twilioSid: sms.smsPhoneNumberSid }
          : null;

      return NextResponse.json({ success: true, numbers, linkable, rentCredits: RENT_CREDITS });
    }

    // Search — only voice-capable results are useful here.
    const result = await searchAvailableNumbers({
      country: searchParams.get("country") || "US",
      areaCode: searchParams.get("areaCode") || undefined,
      contains: searchParams.get("contains") || undefined,
      numberType: (searchParams.get("numberType") as "local" | "tollFree") || "local",
      limit: 12,
    });

    if (!result.success) return fail(result.error || "Could not search for numbers", 502);

    const numbers = (result.numbers || []).filter((n) => n.capabilities.voice);
    return NextResponse.json({ success: true, numbers, rentCredits: RENT_CREDITS });
  } catch (error) {
    console.error("[VoiceAgent/numbers] GET error:", error);
    return fail("Could not load numbers", 500);
  }
}

// ── POST ──

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const body = await request.json();
    const mode: "subscribe" | "link" | "forward" = body.mode || "subscribe";

    // --- Add voice to a number they already rent for SMS. No new rent. ---
    if (mode === "link") {
      const sms = await prisma.marketingConfig.findUnique({
        where: { userId: session.userId },
        select: { smsPhoneNumber: true, smsPhoneNumberSid: true },
      });
      if (!sms?.smsPhoneNumber || !sms.smsPhoneNumberSid) {
        return fail("You don't have a number to add voice to yet.");
      }

      const existing = await prisma.phoneNumber.findUnique({ where: { e164: sms.smsPhoneNumber } });
      if (existing && existing.status !== "RELEASED") {
        return fail("That number already answers calls.");
      }

      const wired = await attachVoiceToNumber(sms.smsPhoneNumberSid);
      if (!wired.success) return fail(wired.error || "Could not set that number up for calls", 502);

      const number = await prisma.phoneNumber.upsert({
        where: { e164: sms.smsPhoneNumber },
        create: {
          userId: session.userId,
          e164: sms.smsPhoneNumber,
          twilioSid: sms.smsPhoneNumberSid,
          source: "SMS_LINKED",
          status: "ACTIVE",
          voiceCapable: true,
          smsCapable: true,
          rentCredits: 0, // already rented by the SMS side — never double-bill
          rentPaidUntil: null,
        },
        update: { status: "ACTIVE", userId: session.userId },
      });

      return NextResponse.json({ success: true, number, charged: 0 });
    }

    // --- Forward an existing business line here. We own nothing, charge nothing. ---
    if (mode === "forward") {
      const e164: string = (body.phoneNumber || "").trim();
      if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
        return fail("Enter your number in full international format, like +14155550142.");
      }

      const clash = await prisma.phoneNumber.findUnique({ where: { e164 } });
      if (clash && clash.status !== "RELEASED") {
        return fail("That number is already set up here.");
      }

      const number = await prisma.phoneNumber.upsert({
        where: { e164 },
        create: {
          userId: session.userId,
          e164,
          source: "FORWARDED",
          status: "PENDING", // until we see a call actually arrive on it
          voiceCapable: true,
          smsCapable: false,
          rentCredits: 0,
          rentPaidUntil: null,
        },
        update: { status: "PENDING", userId: session.userId },
      });

      return NextResponse.json({ success: true, number, charged: 0 });
    }

    // --- Subscribe to a new number. This one costs money. ---
    const phoneNumber: string = (body.phoneNumber || "").trim();
    if (!phoneNumber) return fail("Pick a number first.");

    const balance = await creditService.getBalance(session.userId);
    if (balance < RENT_CREDITS) {
      return fail(
        `You need ${RENT_CREDITS} credits for the first month of this number — you have ${balance}.`,
      );
    }

    // Charge first: a number bought but not billed costs us real rent forever.
    const charge = await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: RENT_CREDITS,
      description: `Voice agent number ${phoneNumber} — first month`,
      referenceType: "voice_number_rental",
      referenceId: phoneNumber,
    });
    if (!charge.success) return fail(charge.error || "Could not take the credits for this number");

    const bought = await purchaseVoiceNumber(phoneNumber);
    if (!bought.success || !bought.sid) {
      // Give it straight back — they were charged for something they didn't get.
      await creditService.addCredits({
        userId: session.userId,
        type: TRANSACTION_TYPES.REFUND,
        amount: RENT_CREDITS,
        description: `Refund — ${phoneNumber} was not available`,
        referenceType: "voice_number_rental_refund",
        referenceId: phoneNumber,
      });
      return fail(bought.error || "That number was taken. Pick another one.", 502);
    }

    const number = await prisma.phoneNumber.create({
      data: {
        userId: session.userId,
        e164: bought.phoneNumber || phoneNumber,
        twilioSid: bought.sid,
        region: body.region || null,
        numberType: body.numberType === "tollFree" ? "tollfree" : "local",
        country: body.country || "US",
        source: "RENTED",
        status: "ACTIVE",
        voiceCapable: true,
        smsCapable: Boolean(body.smsCapable),
        rentCredits: RENT_CREDITS,
        rentPaidUntil: nextPeriod(),
        rentLastBilled: new Date(),
      },
    });

    return NextResponse.json({ success: true, number, charged: RENT_CREDITS });
  } catch (error) {
    console.error("[VoiceAgent/numbers] POST error:", error);
    return fail("Could not set up that number", 500);
  }
}

// ── DELETE ──

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return fail("Which number?");

    const number = await prisma.phoneNumber.findFirst({
      where: { id, userId: session.userId },
    });
    if (!number) return fail("Number not found", 404);

    if (number.source === "SMS_LINKED") {
      // The SMS side still owns and pays for this DID — only stop it answering.
      if (number.twilioSid) await detachVoiceFromNumber(number.twilioSid);
      await prisma.phoneNumber.delete({ where: { id: number.id } });
      return NextResponse.json({ success: true, released: false });
    }

    if (number.source === "FORWARDED") {
      await prisma.phoneNumber.delete({ where: { id: number.id } });
      return NextResponse.json({ success: true, released: false });
    }

    // RENTED: they've paid to the end of the period, so keep it until then
    // rather than deleting something they're still paying for.
    if (searchParams.get("now") !== "1" && number.rentPaidUntil && number.rentPaidUntil > new Date()) {
      const updated = await prisma.phoneNumber.update({
        where: { id: number.id },
        data: { cancelAtPeriodEnd: true },
      });
      return NextResponse.json({ success: true, released: false, number: updated });
    }

    if (number.twilioSid) {
      const released = await releasePhoneNumber(number.twilioSid);
      if (!released.success) return fail(released.error || "Could not release that number", 502);
    }

    await prisma.phoneNumber.update({
      where: { id: number.id },
      data: { status: "RELEASED", releasedAt: new Date(), cancelAtPeriodEnd: false },
    });

    return NextResponse.json({ success: true, released: true });
  } catch (error) {
    console.error("[VoiceAgent/numbers] DELETE error:", error);
    return fail("Could not cancel that number", 500);
  }
}
