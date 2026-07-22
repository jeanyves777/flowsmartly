import { NextRequest, NextResponse } from "next/server";

import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/cron/voice-number-rentals
 *
 * Charges the monthly phone-number rental for every active voice-agent number.
 * Runs daily (idempotent): a number is due when it's never been charged or its
 * last charge is ≥ ~30 days old; each charge stamps `rentalChargedAt`, so a daily
 * run only ever bills a number once a month. Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET || "flowsmartly-cron-2026";
  if (secret !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const amount = await getDynamicCreditCost("VOICE_AGENT_NUMBER_RENTAL").catch(() => 500);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Active voice numbers (real DIDs, actually in use by an agent) that are due.
    const due = await prisma.phoneNumber.findMany({
      where: {
        status: "ACTIVE",
        origin: { in: ["XAI_PROVISIONED", "BYO_TRUNK"] },
        agent: { isNot: null },
        OR: [{ rentalChargedAt: null }, { rentalChargedAt: { lte: cutoff } }],
      },
      select: { id: true, userId: true, e164: true },
    });

    let charged = 0;
    let skipped = 0;
    for (const num of due) {
      try {
        const r = await creditService.deductCredits({
          userId: num.userId,
          type: TRANSACTION_TYPES.USAGE,
          amount,
          description: `Phone number rental · ${num.e164 || "number"} · monthly`,
          referenceType: "voice_number_rental",
          referenceId: num.id,
        });
        if (r.success) {
          await prisma.phoneNumber.update({ where: { id: num.id }, data: { rentalChargedAt: new Date() } });
          charged++;
        } else {
          skipped++; // not enough credits — leave it due; retried next run
        }
      } catch (e) {
        console.error("[cron/voice-number-rentals] charge failed for", num.id, e);
        skipped++;
      }
    }

    console.log(`[Cron] Voice number rentals: ${charged} charged, ${skipped} skipped, of ${due.length} due (@ ${amount} cr).`);
    return NextResponse.json({ success: true, due: due.length, charged, skipped, amount, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[Cron] voice-number-rentals error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
