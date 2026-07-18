/**
 * Voice Agent — phone numbers, on xAI. BRING-YOUR-OWN only.
 *
 * GET    ?action=mine → the user's lines (+ what's answering them, + connect state)
 * POST   {phoneNumber} → the client provides a number they already own. We record
 *                        it as a pending Direct-SIP request; an admin connects it
 *                        one-click from the admin panel (which runs the real xAI
 *                        registration). No console for the client, no provisioning.
 * DELETE ?id=…         → drop / disconnect the line.
 *
 * We never provision numbers (the provider refuses that over the API). Every line
 * is the client's own, joined by Direct SIP. Building an agent never blocks on a
 * number — an agent with no live line is a DRAFT and stays fully editable; only
 * going LIVE needs a connected line that can actually ring.
 */

import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { deleteXaiNumber } from "@/lib/voice-agent/xai-phone";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

const E164 = /^\+[1-9]\d{7,14}$/;

/** Fields safe to return to the client — never the SIP password, signing secret
 *  or webhook token (those are the admin's to relay to the client's carrier). */
const PUBLIC_NUMBER = {
  id: true, e164: true, origin: true, status: true, country: true, region: true,
  friendlyName: true, sipHost: true, sipUsername: true, xaiPhoneNumberId: true,
  createdAt: true,
  agent: { select: { id: true, name: true, status: true } },
} as const;

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
      select: PUBLIC_NUMBER,
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

    // --- The client provides a number they already own. We record it as a pending
    //     Direct-SIP request; an admin connects it one-click (that's what actually
    //     registers it with xAI). The client never touches SIP config. ---
    const phoneNumber: string = (body.phoneNumber || "").trim();
    if (!E164.test(phoneNumber)) {
      return fail("Enter your number in full international format, like +14155550142.");
    }

    const clash = await prisma.phoneNumber.findUnique({ where: { e164: phoneNumber } });
    if (clash && clash.status !== "RELEASED") {
      return fail(
        clash.userId === session.userId
          ? "You've already added that number."
          : "That number is already in use.",
      );
    }

    const number = await prisma.phoneNumber.upsert({
      where: { e164: phoneNumber },
      create: {
        userId: session.userId,
        e164: phoneNumber,
        origin: "BYO_TRUNK",
        status: "REQUESTED",
        country: (body.country || "US").toUpperCase(),
        friendlyName: (body.name || "").slice(0, 80) || null,
        requestNote: (body.note || "").slice(0, 300) || null,
        requestedAt: new Date(),
      },
      update: {
        userId: session.userId,
        origin: "BYO_TRUNK",
        status: "REQUESTED",
        friendlyName: (body.name || "").slice(0, 80) || null,
        requestNote: (body.note || "").slice(0, 300) || null,
        requestedAt: new Date(),
        releasedAt: null,
      },
      select: PUBLIC_NUMBER,
    });

    return NextResponse.json({ success: true, number });
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
